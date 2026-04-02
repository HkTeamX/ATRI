import type { Logger, LogLevelType } from '@huan_kong/logger'
import type { MessageHandler, NCWebsocketOptions, NodeSegment, NoticeHandler, RequestHandler, SendMessageSegment } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { ATRI } from '@/atri.js'
import type { CommandEvent } from '@/plugin/events/command.js'
import type { MessageEvent } from '@/plugin/events/message.js'
import type { NoticeEvent } from '@/plugin/events/notice.js'
import type { RequestEvent } from '@/plugin/events/request.js'
import type { NonEmptyArray } from '@/utils.js'
import process from 'node:process'
import { LogLevel } from '@huan_kong/logger'
import { NCWebsocket, Structs } from 'node-napcat-ts'
import { decodeUnicode, sortObjectArray } from '@/utils.js'

export type BotConfig = NCWebsocketOptions & {
  logLevel?: LogLevelType
  prefix: NonEmptyArray<string>
  adminId: NonEmptyArray<number>
  yargsLocale?: string
}

export interface BotEvents {
  command: CommandEvent[]
  message: MessageEvent[]
  notice: NoticeEvent[]
  request: RequestEvent[]
}

export class Bot {
  atri: ATRI
  config: BotConfig
  logger: Logger
  ws: NCWebsocket
  events: BotEvents = {
    command: [],
    message: [],
    notice: [],
    request: [],
  }

  unloaders: Record<string, (() => void)[]> = {}

  constructor(atri: ATRI, config: BotConfig) {
    this.atri = atri
    this.config = config
    this.logger = this.atri.logger.clone({
      title: 'Bot',
      ...(config.logLevel ? { level: config.logLevel } : {}),
    })
    this.ws = new NCWebsocket(config)
  }

  async init() {
    this.ws.on('socket.connecting', context => this.logger.INFO(`连接中 [#${context.reconnection.nowAttempts}/${context.reconnection.attempts}]`))
    this.ws.on('socket.open', context => this.logger.INFO(`连接成功 [#${context.reconnection.nowAttempts}/${context.reconnection.attempts}]`))
    this.ws.on('socket.error', (context) => {
      if (context.error_type === 'connect_error') {
        this.logger.ERROR(`连接失败 [#${context.reconnection.nowAttempts}/${context.reconnection.attempts}]`)
        this.logger.ERROR(`错误信息:`, context)
      }
      else if (context.error_type === 'response_error') {
        this.logger.ERROR(`NapCat 服务端返回错误 [#${context.reconnection.nowAttempts}/${context.reconnection.attempts}]`)
        this.logger.ERROR('错误信息:', context.info)
        process.exit(1)
      }

      if (context.reconnection.nowAttempts >= context.reconnection.attempts) {
        this.logger.ERROR(`重试次数超过设置的${context.reconnection.attempts}次!`)
        process.exit(1)
      }
    })

    this.ws.on('api.preSend', context => this.logger.DEBUG('发送API请求', context))
    this.ws.on('api.response.success', context => this.logger.DEBUG('收到API成功响应', context))
    this.ws.on('api.response.failure', context => this.logger.DEBUG('收到API失败响应', context))

    this.ws.on('message', async (context) => {
      if (context.message.length === 0) {
        this.logger.DEBUG('收到空消息, 已跳过处理流程:', context)
        return
      }

      const endPoint = `message.${context.message_type}.${context.sub_type}`
      const isAdmin = this.config.adminId.includes(context.user_id)
      const isReply = context.message[0].type === 'reply'

      if (this.config.logLevel === LogLevel.DEBUG && !isAdmin) {
        this.logger.DEBUG('当前处于调试模式, 非管理员消息, 已跳过处理流程:', context)
        return
      }
      else {
        this.logger.DEBUG('收到消息:', context)
      }

      for (const event of this.events.message) {
        if (
          !endPoint.includes(event.endPoint ?? 'message')
          || (event.needReply && !isReply)
          || (event.needAdmin && !isAdmin)
          || (event.trigger && !(typeof event.trigger === 'string' ? context.raw_message.includes(event.trigger) : event.trigger.test(context.raw_message)))
        ) {
          continue
        }

        try {
          const { promise: stepSignal, resolve: resolveCurrentStep } = Promise.withResolvers<void>()

          let nextCalled = false
          const next = () => {
            nextCalled = true
            resolveCurrentStep()
          }

          Promise.resolve(event.callback({ context, atri: this.atri, bot: this, ws: this.ws, logger: this.atri.loggers[event.pluginName] }, next))
            .finally(() => resolveCurrentStep())

          await stepSignal

          if (!nextCalled) {
            this.logger.DEBUG(`插件 ${event.pluginName} 请求提前终止 ${endPoint} 事件`)
            break
          }
        }
        catch (error) {
          this.logger.ERROR(`插件 ${event.pluginName} ${endPoint} 事件处理失败:`, error)
          await this.sendMsg(context, [
            Structs.text(`插件 ${event.pluginName} ${endPoint} 事件处理失败, 请联系管理员处理: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`),
          ])
        }
      }

      const prefix = this.config.prefix.find(item => context.raw_message.startsWith(item))
      // 没有匹配的prefix
      if (!prefix) {
        return
      }

      const rawCommand = context.raw_message.slice(prefix.length).trim()

      for (const event of this.events.command) {
        if (
          !endPoint.includes(event.endPoint ?? 'message')
          || (event.needReply && !isReply)
          || (event.needAdmin && !isAdmin)
        ) {
          continue
        }

        const commandBody = this.extractCommandBody(rawCommand, event.trigger)
        if (commandBody === null) {
          continue
        }

        try {
          const args = this.splitArgs(commandBody)
          const options = event.commander
            ? event.commander().fail(false).parseSync(args)
            : { _: [], $0: '' }

          const { promise: stepSignal, resolve: resolveCurrentStep } = Promise.withResolvers<void>()

          let nextCalled = false
          const next = () => {
            nextCalled = true
            resolveCurrentStep()
          }

          Promise.resolve(event.callback({ context, options, atri: this.atri, bot: this, ws: this.ws, logger: this.atri.loggers[event.pluginName] }, next))
            .finally(() => resolveCurrentStep())

          await stepSignal

          if (!nextCalled) {
            this.logger.DEBUG(`插件 ${event.pluginName} 请求提前终止 ${endPoint} 事件`)
            break
          }
        }
        catch (error) {
          if (error instanceof Error && error.stack?.toString().includes('yargs')) {
            await this.sendMsg(context, [
              Structs.text(`命令使用错误:\n${error.message}\n\n`),
              Structs.text(await event.commander?.()?.getHelp() ?? '无帮助信息'),
            ])
            continue
          }

          this.logger.ERROR(`插件 ${event.pluginName} ${endPoint} 事件处理失败:`, error)
          await this.sendMsg(context, [
            Structs.text(`插件 ${event.pluginName} ${endPoint} 事件处理失败, 请联系管理员处理: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`),
          ])
        }
      }
    })

    this.ws.on('request', async (context) => {
      this.logger.DEBUG('收到请求:', context)
      const endPoint = `request.${context.request_type}.${'sub_type' in context ? context.sub_type : ''}`

      for (const event of this.events.request) {
        if (!endPoint.includes(event.endPoint ?? 'request')) {
          continue
        }

        try {
          const { promise: stepSignal, resolve: resolveCurrentStep } = Promise.withResolvers<void>()

          let nextCalled = false
          const next = () => {
            nextCalled = true
            resolveCurrentStep()
          }

          Promise.resolve(event.callback({ context, atri: this.atri, bot: this, ws: this.ws, logger: this.atri.loggers[event.pluginName] }, next))
            .finally(() => resolveCurrentStep())

          await stepSignal

          if (!nextCalled) {
            this.logger.DEBUG(`插件 ${event.pluginName} 请求提前终止 ${endPoint} 事件`)
            break
          }
        }
        catch (error) {
          this.logger.ERROR(`插件 ${event.pluginName} ${endPoint} 事件处理失败:`, error)
          await this.sendMsg({ message_type: 'private', user_id: this.config.adminId[0] }, [
            Structs.text(`插件 ${event.pluginName} ${endPoint} 事件处理失败: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`),
          ])
        }
      }
    })

    this.ws.on('notice', async (context) => {
      this.logger.DEBUG('收到通知:', context)

      let endPoint = `notice.${context.notice_type}.${'sub_type' in context ? context.sub_type : ''}`
      if (context.notice_type === 'notify') {
        if (context.sub_type === 'input_status') {
          endPoint += `.${context.group_id !== 0 ? 'group' : 'friend'}`
        }
        else if (context.sub_type === 'poke') {
          endPoint += `.${'group_id' in context ? 'group' : 'friend'}`
        }
      }

      for (const event of this.events.notice) {
        if (!endPoint.includes(event.endPoint ?? 'notice')) {
          continue
        }

        try {
          const { promise: stepSignal, resolve: resolveCurrentStep } = Promise.withResolvers<void>()

          let nextCalled = false
          const next = () => {
            nextCalled = true
            resolveCurrentStep()
          }

          Promise.resolve(event.callback({ context, atri: this.atri, bot: this, ws: this.ws, logger: this.atri.loggers[event.pluginName] }, next))
            .finally(() => resolveCurrentStep())

          await stepSignal

          if (!nextCalled) {
            this.logger.DEBUG(`插件 ${event.pluginName} 请求提前终止 ${endPoint} 事件`)
            break
          }
        }
        catch (error) {
          this.logger.ERROR(`插件 ${event.pluginName} ${endPoint} 事件处理失败:`, error)
          await this.sendMsg({ message_type: 'private', user_id: this.config.adminId[0] }, [
            Structs.text(`插件 ${event.pluginName} ${endPoint} 事件处理失败: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`),
          ])
        }
      }
    })

    await this.ws.connect()
    this.logger.INFO(`Bot 初始化完成`)
  }

  splitArgsRegex = /"([^"]*)"|'([^']*)'|(\S+)/g
  splitArgs(str: string): string[] {
    const matches = str.matchAll(this.splitArgsRegex)
    const result: string[] = []

    for (const match of matches) {
      result.push(match[1] || match[2] || match[3])
    }

    return result
  }

  private extractCommandBody(rawCommand: string, trigger: string | RegExp) {
    if (typeof trigger === 'string') {
      if (rawCommand.split(' ')[0] !== trigger) {
        return null
      }

      return rawCommand.slice(trigger.length).trim()
    }

    if (!trigger.test(rawCommand)) {
      return null
    }

    return rawCommand.replace(trigger, '').trim()
  }

  regCommandEvent<T extends keyof MessageHandler, K extends Argv>(_event: Omit<CommandEvent<T, K>, 'type'>) {
    if (_event.commander) {
      // 如果 commander 不是函数，则包装成函数
      if (typeof _event.commander !== 'function') {
        _event.commander = (commander => () => commander)(_event.commander)
      }

      _event.commander()
        .exitProcess(false)
        .usage(`用法: ${decodeUnicode(_event.trigger.toString())} [选项]`)
        .locale(this.config.yargsLocale ?? 'zh_CN')
        .help(false)
        .version(false)
    }

    if (_event.trigger instanceof RegExp) {
      _event.trigger = new RegExp(_event.trigger.source, _event.trigger.flags.replace('g', '').replace('y', ''))
      this.logger.WARN(`插件 ${_event.pluginName} 注册了一个全局正则表达式触发器, 这可能会导致无法正确匹配的问题:`, _event.trigger)
    }

    const event = { ..._event, type: 'command' } as CommandEvent

    this.events.command = sortObjectArray([...this.events.command, event], 'priority', 'down')
    const unload = () => {
      const index = this.events.command.indexOf(event)
      if (index !== -1) {
        this.events.command.splice(index, 1)
      }
    }
    this.unloaders[event.pluginName] = this.unloaders[event.pluginName] ?? []
    this.unloaders[event.pluginName].push(unload)
    return unload
  }

  regMessageEvent<T extends keyof MessageHandler>(_event: Omit<MessageEvent<T>, 'type'>) {
    const event = { ..._event, type: 'message' } as MessageEvent
    this.events.message = sortObjectArray([...this.events.message, event], 'priority', 'down')
    const unload = () => {
      const index = this.events.message.indexOf(event)
      if (index !== -1) {
        this.events.message.splice(index, 1)
      }
    }
    this.unloaders[event.pluginName] = this.unloaders[event.pluginName] ?? []
    this.unloaders[event.pluginName].push(unload)
    return unload
  }

  regNoticeEvent<T extends keyof NoticeHandler>(_event: Omit<NoticeEvent<T>, 'type'>) {
    const event = { ..._event, type: 'notice' } as NoticeEvent
    this.events.notice = sortObjectArray([...this.events.notice, event], 'priority', 'down')
    const unload = () => {
      const index = this.events.notice.indexOf(event)
      if (index !== -1) {
        this.events.notice.splice(index, 1)
      }
    }
    this.unloaders[event.pluginName] = this.unloaders[event.pluginName] ?? []
    this.unloaders[event.pluginName].push(unload)
    return unload
  }

  regRequestEvent<T extends keyof RequestHandler>(_event: Omit<RequestEvent<T>, 'type'>) {
    const event = { ..._event, type: 'request' } as RequestEvent
    this.events.request = sortObjectArray([...this.events.request, event], 'priority', 'down')
    const unload = () => {
      const index = this.events.request.indexOf(event)
      if (index !== -1) {
        this.events.request.splice(index, 1)
      }
    }
    this.unloaders[event.pluginName] = this.unloaders[event.pluginName] ?? []
    this.unloaders[event.pluginName].push(unload)
    return unload
  }

  /**
   * 发送普通消息
   */
  async sendMsg(
    context:
      | { message_type: 'private', user_id: number, message_id?: number }
      | { message_type: 'group', group_id: number, user_id?: number, message_id?: number },
    message: SendMessageSegment[],
    { reply = true, at = true } = {},
  ) {
    try {
      if (context.message_type === 'private') {
        return await this.ws.send_private_msg({ user_id: context.user_id, message })
      }
      else {
        const prefix: SendMessageSegment[] = []

        if (reply && context.message_id)
          prefix.push(Structs.reply(context.message_id))
        if (at && context.user_id)
          prefix.push(Structs.at(context.user_id), Structs.text('\n'))

        message = [...prefix, ...message]
        return await this.ws.send_group_msg({ group_id: context.group_id, message })
      }
    }
    catch {
      return null
    }
  }

  /**
   * 发送合并转发
   */
  async sendForwardMsg(
    context:
      | { message_type: 'group', group_id: number }
      | { message_type: 'private', user_id: number },
    message: NodeSegment[],
  ) {
    try {
      if (context.message_type === 'private') {
        return await this.ws.send_private_forward_msg({
          user_id: context.user_id,
          message,
        })
      }
      else {
        return await this.ws.send_group_forward_msg({
          group_id: context.group_id,
          message,
        })
      }
    }
    catch {
      return null
    }
  }

  /**
   * 判断是否是机器人的好友
   */
  async isFriend(context: { user_id: number }) {
    return this.ws
      .get_friend_list()
      .then(res => res.find(value => value.user_id === context.user_id))
  }

  /**
   * 获取用户名
   */
  async getUsername(context: { user_id: number } | { user_id: number, group_id: number }) {
    if ('group_id' in context) {
      return this.ws
        .get_group_member_info({ group_id: context.group_id, user_id: context.user_id })
        .then(res => res.nickname)
    }
    else {
      return this.ws.get_stranger_info({ user_id: context.user_id }).then(res => res.nickname)
    }
  }
}
