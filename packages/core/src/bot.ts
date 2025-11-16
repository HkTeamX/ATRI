import { InjectLogger, Logger, LogLevel } from '@huan_kong/logger'
import { CommanderError, type Command } from 'commander'
import { NCWebsocket, Structs, type NodeSegment, type SendMessageSegment } from 'node-napcat-ts'
import type { BotConfig, BotEvents, CommandData } from './types/bot.js'
import type { CommandEvent, RegEventOptions } from './types/plugin.js'
import { performanceCounter, sortObjectArray } from './utils.js'

export class Bot extends InjectLogger {
  ws: NCWebsocket
  config: BotConfig

  events: BotEvents = {
    command: [],
    message: [],
    notice: [],
    request: [],
  }

  private constructor(config: BotConfig, ws: NCWebsocket) {
    super({ level: config.logLevel ?? (config.debug ? LogLevel.DEBUG : undefined) })
    this.ws = ws
    this.config = config

    if (config.debug) {
      ws.on('api.preSend', (context) => this.logger.DEBUG('发送API请求', context))
      ws.on('api.response.success', (context) => this.logger.DEBUG('收到API成功响应', context))
      ws.on('api.response.failure', (context) => this.logger.DEBUG('收到API失败响应', context))
      ws.on('message', (context) => {
        // 过滤空消息
        if (context.message.length === 0) {
          this.logger.DEBUG('收到空消息, 已跳过处理流程:', context)
          return
        }
        this.logger.DEBUG('收到消息:', context)
      })
      ws.on('request', (context) => this.logger.DEBUG('收到请求:', context))
      ws.on('notice', (context) => this.logger.DEBUG('收到通知:', context))
    }

    ws.on('message', async (context) => {
      // 过滤空消息
      if (context.message.length === 0) return
      // 调试模式下非管理员消息不处理
      if (this.config.debug && !this.config.adminId.includes(context.user_id)) return

      const endpoint = `message.${context.message_type}.${context.sub_type}`
      const isAdmin = this.config.adminId.includes(context.user_id)
      const isReply = context.message[0].type === 'reply'

      for (const event of this.events.message) {
        if (
          endpoint.includes(event.endPoint ?? 'message') &&
          (event.needReply ? isReply : true) &&
          (event.needAdmin ? isAdmin : true) &&
          (event.regexp ? event.regexp.test(context.raw_message) : true)
        ) {
          try {
            const result = await event.callback({ context })
            if (result === 'quit') {
              this.logger.DEBUG(`插件 ${event.packageName} 请求提前终止`)
              break
            }
          } catch (error) {
            this.logger.ERROR(`插件 ${event.packageName} 事件处理失败:`, error)
          }
        }
      }

      for (const event of this.events.command) {
        if (
          endpoint.includes(event.endPoint ?? 'message') &&
          (event.needAdmin ? isAdmin : true) &&
          (event.needReply ? isReply : true)
        ) {
          const [retCode, dataOrMessage] = this.parseCommand(
            context.raw_message,
            event.commandName,
            event.commander,
          )

          if (retCode === 1) continue
          if (retCode === 2) {
            await this.sendMsg(context, [Structs.text(dataOrMessage)])
            continue
          }

          const { prefix, commandName, params, args } = dataOrMessage

          // 处理成功事件
          try {
            const result = await event.callback({
              context,
              prefix,
              commandName,
              params,
              args,
            })
            if (result === 'quit') {
              this.logger.DEBUG(`插件 ${event.packageName} 请求提前终止`)
              break
            }
          } catch (error) {
            this.logger.ERROR(`插件 ${event.packageName} 事件处理失败:`, error)
          }
        }
      }
    })

    ws.on('request', async (context) => {
      const endpoint = `request.${context.request_type}.${'sub_type' in context ? context.sub_type : ''}`

      for (const event of this.events.request) {
        if (endpoint.includes(event.endPoint ?? 'request')) {
          try {
            const result = await event.callback({ context })
            if (result === 'quit') {
              this.logger.DEBUG(`插件 ${event.packageName} 请求提前终止`)
              break
            }
          } catch (error) {
            this.logger.ERROR(`插件 ${event.packageName} 事件处理失败:`, error)
          }
        }
      }
    })

    ws.on('notice', async (context) => {
      let endpoint = `notice.${context.notice_type}.${'sub_type' in context ? context.sub_type : ''}`
      if (context.notice_type === 'notify') {
        if (context.sub_type === 'input_status') {
          endpoint += `.${context.group_id !== 0 ? 'group' : 'friend'}`
        } else if (context.sub_type === 'poke') {
          endpoint += `.${'group_id' in context ? 'group' : 'friend'}`
        }
      }

      for (const event of this.events.notice) {
        if (endpoint.includes(event.endPoint ?? 'notice')) {
          try {
            const result = await event.callback({ context })
            if (result === 'quit') {
              this.logger.DEBUG(`插件 ${event.packageName} 请求提前终止`)
              break
            }
          } catch (error) {
            this.logger.ERROR(`插件 ${event.packageName} 事件处理失败:`, error)
          }
        }
      }
    })

    this.logger.INFO(`Bot 初始化完成`)
  }

  static async init(config: BotConfig) {
    return new Promise<Bot>((resolve, reject) => {
      const logger = new Logger({
        title: 'Bot',
        level: config.logLevel ?? (config.debug ? LogLevel.DEBUG : undefined),
      })

      const ws = new NCWebsocket({
        ...config.connection,
        reconnection: config.reconnection,
      })

      let getElapsedTimeMs = performanceCounter()

      ws.on('socket.connecting', (context) => {
        getElapsedTimeMs = performanceCounter()
        logger.INFO(
          `连接中 [#${context.reconnection.nowAttempts}/${context.reconnection.attempts}]`,
        )
      })

      ws.on('socket.error', (context) => {
        logger.ERROR(
          `连接失败 [#${context.reconnection.nowAttempts}/${context.reconnection.attempts}]`,
        )
        logger.ERROR(`错误信息:`, context)

        if (context.error_type === 'response_error') {
          logger.ERROR(`NapCat 服务端返回错误, 可能是 AccessToken 错误`)
          process.exit(1)
        }

        if (context.reconnection.nowAttempts >= context.reconnection.attempts) {
          reject(`重试次数超过设置的${context.reconnection.attempts}次!`)
          throw new Error(`重试次数超过设置的${context.reconnection.attempts}次!`)
        }
      })

      ws.on('socket.open', async (context) => {
        logger.INFO(
          `连接成功 [#${context.reconnection.nowAttempts}/${context.reconnection.attempts}]`,
        )
        logger.INFO(`连接 NapCat 耗时: ${getElapsedTimeMs()}ms`)

        resolve(new Bot(config, ws))
      })

      ws.connect()
    })
  }

  /**
   * 注册事件
   */
  regEvent(_options: RegEventOptions) {
    const options = { ..._options, priority: _options.priority ?? 1 }

    switch (options.type) {
      case 'command':
        this.events.command = sortObjectArray([...this.events.command, options], 'priority', 'down')
        return () => {
          const index = this.events.command.indexOf(options)
          if (index !== -1) this.events.command.splice(index, 1)
        }
      case 'message':
        this.events.message = sortObjectArray([...this.events.message, options], 'priority', 'down')
        return () => {
          const index = this.events.message.indexOf(options)
          if (index !== -1) this.events.message.splice(index, 1)
        }
      case 'notice':
        this.events.notice = sortObjectArray([...this.events.notice, options], 'priority', 'down')
        return () => {
          const index = this.events.notice.indexOf(options)
          if (index !== -1) this.events.notice.splice(index, 1)
        }
      case 'request':
        this.events.request = sortObjectArray([...this.events.request, options], 'priority', 'down')
        return () => {
          const index = this.events.request.indexOf(options)
          if (index !== -1) this.events.request.splice(index, 1)
        }
    }
  }

  /**
   * 解析命令
   * @param rawMessage 原始消息
   * @param commandName 命令名称
   * @param command 命令对象
   * @returns 解析结果
   */
  parseCommand(
    rawMessage: string,
    commandName: CommandEvent['commandName'],
    command?: Command,
  ): [0, CommandData] | [1, string] | [2, string] {
    // 判断prefix是否满足
    const firstChar = rawMessage.charAt(0)
    const prefix = this.config.prefix.find((p) => p === firstChar)
    if (!prefix) return [1, '未匹配到前缀']

    const parts = rawMessage.split(' ')
    if (parts.length === 0) return [1, '命令信息未空']

    const cmdName = parts[0].slice(prefix.length)
    const args = parts.slice(1).filter((arg) => arg !== '')

    // 检查命令名是否匹配
    if (
      commandName !== '*' &&
      ((typeof commandName === 'string' && commandName !== cmdName) ||
        (commandName instanceof RegExp && cmdName.match(commandName) === null))
    ) {
      return [1, '命令名不匹配']
    }

    if (command) {
      try {
        const parsedCommand = command
          .configureOutput({ writeErr: () => {}, writeOut: () => {} })
          .exitOverride()
          .parse(args, { from: 'user' })

        return [
          0,
          {
            prefix,
            commandName: cmdName,
            params: parsedCommand.opts(),
            args: parsedCommand.processedArgs,
          },
        ]
      } catch (error) {
        if (
          error instanceof CommanderError ||
          ('code' in (error as CommanderError) && 'message' in (error as CommanderError))
        ) {
          const { code, message } = error as CommanderError

          if (code === 'commander.helpDisplayed') {
            const helpInformation = this.getCommandHelpInformation(commandName.toString())
            return [2, helpInformation ?? '']
          }

          const errorMessage = message
            .replace('error:', '错误:')
            .replace('unknown option', '未知选项')
            .replace('missing required argument', '缺少必要参数')
            .replace('too many arguments', '参数过多')
            .replace('invalid argument', '无效参数')
            .replace("option '", "选项 '")
            .replace('argument missing', '缺少参数')
            .replace('Did you mean', '你是想要')
            .replace(
              /Expected (\d+) arguments? but got (\d+)\./,
              '期望 $1 个参数，但得到了 $2 个参数。',
            )

          return [
            2,
            errorMessage + (errorMessage.includes('你是想要') ? '' : '\n(使用 -h 获取帮助信息)'),
          ]
        } else {
          this.logger.ERROR('命令处理出错:', error)
          return [2, error instanceof Error ? error.message : '未知错误']
        }
      }
    }

    return [
      0,
      {
        prefix,
        commandName: cmdName,
        params: {},
        args: [],
      },
    ]
  }

  /**
   * 获取命令信息
   * @param command 命令对象
   * @param fallback 后备值
   * @param field 字段名
   * @returns 命令信息
   */
  getCommandInfo(command: Command, fallback: string, field: 'name' | 'description' = 'name') {
    const commandInfo = command[field]().replace('/', '')
    return commandInfo === '' || commandInfo === 'program' ? fallback : commandInfo
  }

  /**
   * 获取命令帮助信息
   * @param commandName 命令名称
   */
  getCommandHelpInformation(commandName: string) {
    // 搜索命令
    const foundEvent = this.events.command.find((cmd) => {
      if (cmd.commandName === '*') return false
      if (typeof cmd.commandName === 'string') {
        return cmd.commandName === commandName
      } else if (cmd.commandName instanceof RegExp) {
        return cmd.commandName.test(commandName)
      }
      return false
    })
    if (!foundEvent || !foundEvent.commander) return undefined

    const resolvedCommandName = this.getCommandInfo(
      foundEvent.commander,
      foundEvent.commandName.toString(),
    )
    const defaultPrefix = this.config.prefix[0]

    const helpInformation = foundEvent.commander
      .name(
        resolvedCommandName.includes(defaultPrefix)
          ? resolvedCommandName
          : `${defaultPrefix}${resolvedCommandName}`,
      )
      .helpOption('-h, --help', '展示帮助信息')
      .helpInformation()
      .replaceAll('default:', '默认值:')
      .replace('Arguments:', '参数:')
      .replace('Options:', '选项:')
      .replace('Usage:', '用法:')

    return helpInformation
  }

  /**
   * 发送普通消息
   */
  async sendMsg(
    context:
      | { message_type: 'private'; user_id: number; message_id?: number }
      | { message_type: 'group'; group_id: number; user_id?: number; message_id?: number },
    message: SendMessageSegment[],
    { reply = true, at = true } = {},
  ) {
    try {
      if (context.message_type === 'private') {
        return await this.ws.send_private_msg({ user_id: context.user_id, message })
      } else {
        const prefix: SendMessageSegment[] = []

        if (reply && context.message_id) prefix.push(Structs.reply(context.message_id))
        if (at && context.user_id) prefix.push(Structs.at(context.user_id), Structs.text('\n'))

        message = [...prefix, ...message]
        return await this.ws.send_group_msg({ group_id: context.group_id, message })
      }
    } catch {
      return null
    }
  }

  /**
   * 发送合并转发
   */
  async sendForwardMsg(
    context:
      | { message_type: 'group'; group_id: number }
      | { message_type: 'private'; user_id: number },
    message: NodeSegment[],
  ) {
    try {
      if (context.message_type === 'private') {
        return await this.ws.send_private_forward_msg({
          user_id: context.user_id,
          message,
        })
      } else {
        return await this.ws.send_group_forward_msg({
          group_id: context.group_id,
          message,
        })
      }
    } catch {
      return null
    }
  }

  /**
   * 判断是否是机器人的好友
   */
  async isFriend(context: { user_id: number }) {
    return this.ws
      .get_friend_list()
      .then((res) => res.find((value) => value.user_id === context.user_id))
  }

  /**
   * 获取用户名
   */
  async getUsername(context: { user_id: number } | { user_id: number; group_id: number }) {
    if ('group_id' in context) {
      return this.ws
        .get_group_member_info({ group_id: context.group_id, user_id: context.user_id })
        .then((res) => res.nickname)
    } else {
      return this.ws.get_stranger_info({ user_id: context.user_id }).then((res) => res.nickname)
    }
  }
}
