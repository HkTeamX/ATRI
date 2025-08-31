import { CommanderError, type Command, type OptionValues } from 'commander'
import type { NCWebsocketOptions, NodeSegment, SendMessageSegment } from 'node-napcat-ts'
import { NCWebsocket, Structs } from 'node-napcat-ts'
import process from 'node:process'
import { Logger } from './logger.js'
import type {
  CommandEvent,
  MessageEvent,
  NoticeEvent,
  RegEventOptions,
  RequestEvent,
} from './reg_event.js'
import {
  get_command_info,
  performance_counter,
  sort_object_array,
  type NonEmptyArray,
  type RemoveField,
} from './utils.js'

export type BotConfig = {
  debug?: boolean
  prefix: NonEmptyArray<string>
  admin_id: NonEmptyArray<number>
  connection: RemoveField<NCWebsocketOptions, 'reconnection'>
  reconnection: NCWebsocketOptions['reconnection']
}

export interface BotEvents {
  command: CommandEvent[]
  message: MessageEvent[]
  notice: NoticeEvent[]
  request: RequestEvent[]
}

export class Bot {
  logger: Logger
  ws: NCWebsocket
  config: BotConfig

  events: BotEvents = {
    command: [],
    message: [],
    notice: [],
    request: [],
  }

  constructor(config: BotConfig, ws: NCWebsocket) {
    this.logger = new Logger('Bot', config.debug)
    this.ws = ws
    this.config = config

    if (config.debug) {
      ws.on('api.preSend', (context) => this.logger.DEBUG('发送API请求', context))
      ws.on('api.response.success', (context) => this.logger.DEBUG('收到API成功响应', context))
      ws.on('api.response.failure', (context) => this.logger.DEBUG('收到API失败响应', context))
      ws.on('message', (context) => this.logger.DEBUG('收到消息:', context))
      ws.on('request', (context) => this.logger.DEBUG('收到请求:', context))
      ws.on('notice', (context) => this.logger.DEBUG('收到通知:', context))
    }

    ws.on('message', async (context) => {
      const end_point = `message.${context.message_type}.${context.sub_type}`
      const is_admin = this.config.admin_id.includes(context.user_id)
      const is_reply = context.message[0].type === 'reply'

      for (const event of this.events.message) {
        if (
          end_point.includes(event.end_point ?? 'message') &&
          (event.need_admin ? is_admin : true) &&
          (event.need_reply ? is_reply : true) &&
          (event.regexp ? event.regexp.test(context.raw_message) : true)
        ) {
          try {
            const result = await event.callback({ context })
            if (result === 'quit') {
              this.logger.DEBUG(`插件 ${event.plugin_name} 请求提前终止`)
              break
            }
          } catch (error) {
            this.logger.ERROR(`插件 ${event.plugin_name} 事件处理失败:`, error)
          }
        }
      }

      for (const event of this.events.command) {
        if (
          end_point.includes(event.end_point ?? 'message') &&
          (event.need_admin ? is_admin : true) &&
          (event.need_reply ? is_reply : true)
        ) {
          const parsed_command = this.parse_command(
            context.raw_message,
            event.command_name,
            event.commander,
          )

          const ret = parsed_command[0]
          if (ret === 1) continue
          if (ret === 2) {
            await this.send_msg(context, [Structs.text(parsed_command[1])])
            continue
          }

          // 处理成功事件
          const [_, prefix, command_name, params, args] = parsed_command
          try {
            const result = await event.callback({
              context,
              prefix,
              command_name,
              params,
              args,
            })
            if (result === 'quit') {
              this.logger.DEBUG(`插件 ${event.plugin_name} 请求提前终止`)
              break
            }
          } catch (error) {
            this.logger.ERROR(`插件 ${event.plugin_name} 事件处理失败:`, error)
          }
        }
      }
    })

    ws.on('request', async (context) => {
      const end_point = `request.${context.request_type}.${'sub_type' in context ? context.sub_type : ''}`

      for (const event of this.events.request) {
        if (end_point.includes(event.end_point ?? 'request')) {
          try {
            const result = await event.callback({ context })
            if (result === 'quit') {
              this.logger.DEBUG(`插件 ${event.plugin_name} 请求提前终止`)
              break
            }
          } catch (error) {
            this.logger.ERROR(`插件 ${event.plugin_name} 事件处理失败:`, error)
          }
        }
      }
    })

    ws.on('notice', async (context) => {
      let end_point = `notice.${context.notice_type}.${'sub_type' in context ? context.sub_type : ''}`
      if (context.notice_type === 'notify') {
        if (context.sub_type === 'input_status') {
          end_point += `.${context.group_id !== 0 ? 'group' : 'friend'}`
        } else if (context.sub_type === 'poke') {
          end_point += `.${'group_id' in context ? 'group' : 'friend'}`
        }
      }

      for (const event of this.events.notice) {
        if (end_point.includes(event.end_point ?? 'notice')) {
          try {
            const result = await event.callback({ context })
            if (result === 'quit') {
              this.logger.DEBUG(`插件 ${event.plugin_name} 请求提前终止`)
              break
            }
          } catch (error) {
            this.logger.ERROR(`插件 ${event.plugin_name} 事件处理失败:`, error)
          }
        }
      }
    })

    this.logger.SUCCESS(`Bot 初始化完成`)
  }

  static async init(config: BotConfig) {
    return new Promise<Bot>((resolve, reject) => {
      const logger = new Logger('Bot', config.debug)
      logger.DEBUG(`初始化 Bot 实例`)
      logger.DEBUG(`配置信息:`, config)

      const ws = new NCWebsocket({
        ...config.connection,
        reconnection: config.reconnection,
      })

      let get_elapsed_time = performance_counter()

      ws.on('socket.connecting', (context) => {
        get_elapsed_time = performance_counter()
        logger.INFO(`连接中#${context.reconnection.nowAttempts}/${context.reconnection.attempts}`)
      })

      ws.on('socket.error', (context) => {
        logger.ERROR(
          `连接失败#${context.reconnection.nowAttempts}/${context.reconnection.attempts}`,
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
        logger.SUCCESS(
          `连接成功#${context.reconnection.nowAttempts}/${context.reconnection.attempts}`,
        )

        logger.INFO(`连接 NapCat 耗时: ${get_elapsed_time()}ms`)

        resolve(new Bot(config, ws))
      })

      ws.connect()
    })
  }

  reg_event(_options: RegEventOptions) {
    const options = { ..._options, priority: _options.priority ?? 1 }

    switch (options.type) {
      case 'command':
        this.events.command = sort_object_array(
          [...this.events.command, options],
          'priority',
          'down',
        )
        break
      case 'message':
        this.events.message = sort_object_array(
          [...this.events.message, options],
          'priority',
          'down',
        )
        break
      case 'notice':
        this.events.notice = sort_object_array([...this.events.notice, options], 'priority', 'down')
        break
      case 'request':
        this.events.request = sort_object_array(
          [...this.events.request, options],
          'priority',
          'down',
        )
        break
    }
  }

  /**
   * 解析命令
   * 0 - 解析成功
   * 1 - 未匹配命令特征
   * 2 - 参数不合法
   */
  parse_command(
    raw_message: string,
    command_name: CommandEvent['command_name'],
    command?: Command,
  ): [0, string, string, OptionValues, any[]] | [1, string] | [2, string] {
    // 判断prefix是否满足
    const first_letter = raw_message.charAt(0)
    const prefix = this.config.prefix.find((p) => p === first_letter)
    if (!prefix) return [1, '未匹配到前缀']

    const arr = raw_message.split(' ')
    if (arr.length === 0) return [1, '命令信息未空']

    const now_command_name = arr[0].slice(prefix.length)
    const now_params = arr.slice(1).filter((v) => v !== '')

    // 检查命令名是否匹配
    if (
      command_name !== '*' &&
      ((typeof command_name === 'string' && command_name !== now_command_name) ||
        (command_name instanceof RegExp && now_command_name.match(command_name) === null))
    ) {
      return [1, '命令名不匹配']
    }

    if (command) {
      try {
        const parsed_command = command
          .configureOutput({ writeErr: () => {}, writeOut: () => {} })
          .exitOverride()
          .parse(now_params, { from: 'user' })

        return [0, prefix, now_command_name, parsed_command.opts(), parsed_command.processedArgs]
      } catch (error) {
        if (error instanceof CommanderError) {
          if (error.code === 'commander.helpDisplayed') {
            const help_information = this.get_command_help_information(command_name.toString())
            return [2, help_information ?? '']
          }

          error.message = error.message
            .replace('error:', '错误:')
            .replace('unknown option', '未知选项')
            .replace('missing required argument', '缺少必要参数')
            .replace('too many arguments', '参数过多')
            .replace('invalid argument', '无效参数')
            .replace("option '", "选项 '")
            .replace('argument missing', '缺少参数')
            .replace('Did you mean', '你是想要')

          return [
            2,
            error.message + (error.message.includes('你是想要') ? '' : '\n(使用 -h 获取帮助信息)'),
          ]
        } else {
          this.logger.ERROR(error)
          return [2, '未知错误']
        }
      }
    }

    return [0, prefix, now_command_name, {}, []]
  }

  get_command_help_information(command_name: string) {
    // 搜索命令
    const event = this.events.command.find((cmd) => cmd.command_name.toString() === command_name)
    if (!event || !event.commander) return undefined

    const now_command_name = get_command_info(event.commander, event.command_name.toString())
    const prefix = this.config.prefix[0]

    const help_information = event.commander
      .name(now_command_name.includes(prefix) ? now_command_name : `${prefix}${now_command_name}`)
      .helpOption('-h, --help', '展示帮助信息')
      .helpInformation()
      .replace('default:', '默认值:')
      .replace('Arguments:', '参数:')
      .replace('Options:', '选项:')
      .replace('Usage:', '用法:')

    return help_information
  }

  /**
   * 发送普通消息
   */
  async send_msg(
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
  async send_forward_msg(
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
  async is_friend(context: { user_id: number }) {
    return this.ws
      .get_friend_list()
      .then((res) => res.find((value) => value.user_id === context.user_id))
  }

  /**
   * 获取用户名
   */
  async get_username(context: { user_id: number } | { user_id: number; group_id: number }) {
    if ('group_id' in context) {
      return this.ws
        .get_group_member_info({ group_id: context.group_id, user_id: context.user_id })
        .then((res) => res.nickname)
    } else {
      return this.ws.get_stranger_info({ user_id: context.user_id }).then((res) => res.nickname)
    }
  }
}
