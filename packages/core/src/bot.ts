import type { Logger, LogLevelType } from '@huan_kong/logger'
import type { MessageHandler, NCWebsocketOptions, NodeSegment, NoticeHandler, RequestHandler, SendMessageSegment } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { ATRI } from './atri.js'
import type { MaybePromise, NonEmptyArray } from './utils.js'
import process from 'node:process'
import { LogLevel } from '@huan_kong/logger'
import { NCWebsocket, Structs } from 'node-napcat-ts'
import { ConversationBuilder } from './builder.js'
import { decodeUnicode, sortObjectArray } from './utils.js'

export type BotConfig = NCWebsocketOptions & {
  logLevel?: LogLevelType
  prefix: NonEmptyArray<string>
  adminId: NonEmptyArray<number>
  yargsLocale?: string
}

export interface CommandContext<T extends keyof MessageHandler, K extends Argv> {
  context: MessageHandler[T]
  options: ReturnType<K['parseSync']>
}

export interface CommandEvent<T extends keyof MessageHandler = keyof MessageHandler, K extends Argv = Argv> {
  type: 'command'
  endPoint?: T
  trigger: string | RegExp
  priority?: number
  needReply?: boolean
  needAdmin?: boolean
  hideInHelp?: boolean
  pluginName: string
  commander?: () => K
  callback: (context: CommandContext<T, K>) => MaybePromise<void | 'quit'>
}

export interface MessageContext<T extends keyof MessageHandler> {
  context: MessageHandler[T]
}

export interface MessageEvent<T extends keyof MessageHandler = keyof MessageHandler> {
  type: 'message'
  endPoint?: T
  trigger?: string | RegExp
  priority?: number
  needReply?: boolean
  needAdmin?: boolean
  pluginName: string
  callback: (context: MessageContext<T>) => MaybePromise<void | 'quit'>
}

export interface NoticeContext<T extends keyof NoticeHandler> {
  context: NoticeHandler[T]
}

export interface NoticeEvent<T extends keyof NoticeHandler = keyof NoticeHandler> {
  type: 'notice'
  endPoint?: T
  priority?: number
  pluginName: string
  callback: (context: NoticeContext<T>) => MaybePromise<void | 'quit'>
}

export interface RequestContext<T extends keyof RequestHandler> {
  context: RequestHandler[T]
}

export interface RequestEvent<T extends keyof RequestHandler = keyof RequestHandler> {
  type: 'request'
  endPoint?: T
  priority?: number
  pluginName: string
  callback: (context: RequestContext<T>) => MaybePromise<void | 'quit'>
}

export interface BotEvents {
  command: CommandEvent[]
  message: MessageEvent[]
  notice: NoticeEvent[]
  request: RequestEvent[]
}

type AnyMessageContext = MessageHandler[keyof MessageHandler]

interface UserConversationState {
  conversationKey: string
  stepIndex: number
  data: Record<string, unknown>
  retryCount: number
  timeoutInterval: NodeJS.Timeout | null
}

export class Bot {
  atri: ATRI
  config: BotConfig
  logger: Logger
  ws: NCWebsocket
  //           user_id@group_id [ConversationBuilder]
  conversations: Record<string, ConversationBuilder<any, any, any>>
  //           user_id@group_id [conversation_key,index,data,retryCount]
  usersConversations: Record<string, UserConversationState>
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
    this.conversations = {}
    this.usersConversations = {}
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

      // 优先处理连续对话相关内容
      const res = await this.processConversationMessage(context)
      if (res === 'quit') {
        return
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
          const result = await event.callback({ context })

          if (result === 'quit') {
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

          const result = await event.callback({
            context,
            options,
          })

          if (result === 'quit') {
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
      const endpoint = `request.${context.request_type}.${'sub_type' in context ? context.sub_type : ''}`

      for (const event of this.events.request) {
        if (!endpoint.includes(event.endPoint ?? 'request')) {
          continue
        }

        try {
          const result = await event.callback({ context })

          if (result === 'quit') {
            this.logger.DEBUG(`插件 ${event.pluginName} 请求提前终止 ${endpoint} 事件`)
            break
          }
        }
        catch (error) {
          this.logger.ERROR(`插件 ${event.pluginName} ${endpoint} 事件处理失败:`, error)
          await this.sendMsg({ message_type: 'private', user_id: this.config.adminId[0] }, [
            Structs.text(`插件 ${event.pluginName} ${endpoint} 事件处理失败: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`),
          ])
        }
      }
    })

    this.ws.on('notice', async (context) => {
      this.logger.DEBUG('收到通知:', context)

      let endpoint = `notice.${context.notice_type}.${'sub_type' in context ? context.sub_type : ''}`
      if (context.notice_type === 'notify') {
        if (context.sub_type === 'input_status') {
          endpoint += `.${context.group_id !== 0 ? 'group' : 'friend'}`
        }
        else if (context.sub_type === 'poke') {
          endpoint += `.${'group_id' in context ? 'group' : 'friend'}`
        }
      }

      for (const event of this.events.notice) {
        if (!endpoint.includes(event.endPoint ?? 'notice')) {
          continue
        }

        try {
          const result = await event.callback({ context })

          if (result === 'quit') {
            this.logger.DEBUG(`插件 ${event.pluginName} 请求提前终止 ${endpoint} 事件`)
            break
          }
        }
        catch (error) {
          this.logger.ERROR(`插件 ${event.pluginName} ${endpoint} 事件处理失败:`, error)
          await this.sendMsg({ message_type: 'private', user_id: this.config.adminId[0] }, [
            Structs.text(`插件 ${event.pluginName} ${endpoint} 事件处理失败: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`),
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

  regCommandEvent<T extends keyof MessageHandler, K extends Argv>(_event: Omit<CommandEvent<T, K>, 'type' | 'callback'> & {
    callback: CommandEvent<T, K>['callback'] | ConversationBuilder<T, K, any>
  }) {
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

    if (_event.callback instanceof ConversationBuilder) {
      // 重写一个新的 callback 来适配 ConversationBuilder, 并添加到 conversations 里
      const conversationOptions = _event.callback.getOptions()
      if (this.conversations[conversationOptions.conversationKey]) {
        const msg = `conversation_key ${conversationOptions.conversationKey} 已存在, 请更换一个新的 conversation_key`
        this.logger.WARN(msg)
        throw new Error(msg)
      }

      this.conversations[conversationOptions.conversationKey] = _event.callback

      _event.callback = async (context) => {
        const userKey = this.getConversationUserKey(context.context)
        this.usersConversations[userKey] = {
          conversationKey: conversationOptions.conversationKey,
          stepIndex: 0,
          data: {},
          retryCount: 0,
          timeoutInterval: null,
        }

        const conversation = this.conversations[conversationOptions.conversationKey]
        if (!conversation) {
          await this.sendMsg(context.context, [Structs.text('发生错误: 未找到对应的 conversation')])
          this.logger.ERROR(`未找到 conversation_key ${conversationOptions.conversationKey} 对应的 ConversationBuilder`)
          return
        }

        const res = await conversation.getHandler()(context)
        if (res !== 'quit') {
          this.usersConversations[userKey].data = res ?? {}
          // 设置连续对话超时, 使用第一个step的超时时间
          this.scheduleConversationTimeout(
            userKey,
            context.context,
            this.getStepTimeout(conversation, 0),
          )
        }
        return res
      }
    }

    const event = { ..._event, type: 'command' } as CommandEvent

    this.events.command = sortObjectArray([...this.events.command, event], 'priority', 'down')
    const unload = () => {
      const index = this.events.command.indexOf(event)
      if (index !== -1) {
        this.events.command.splice(index, 1)
      }

      if (event.callback instanceof ConversationBuilder) {
        const conversationOptions = event.callback.getOptions()
        delete this.conversations[conversationOptions.conversationKey]
      }
    }
    this.unloaders[event.pluginName] = this.unloaders[event.pluginName] ?? []
    this.unloaders[event.pluginName].push(unload)
    return unload
  }

  private getConversationUserKey(context: AnyMessageContext) {
    return `${context.user_id}@${'group_id' in context ? context.group_id : 'private'}`
  }

  /**
   * quit 表示正在消费这个消息，不再进入后续事件处理流程
   * void 表示继续进入后续事件处理流程
   */
  private async processConversationMessage(context: AnyMessageContext): Promise<void | 'quit'> {
    const userConversationKey = this.getConversationUserKey(context)
    const userConversation = this.usersConversations[userConversationKey]
    if (!userConversation) {
      return
    }

    this.clearConversationTimeout(userConversationKey)

    this.logger.DEBUG(`用户 ${userConversationKey} 当前处于连续对话中, 已优先进入连续对话处理流程`)

    if (context.raw_message === '退出') {
      this.logger.DEBUG(`用户 ${userConversationKey} 发送退出命令, 已退出连续对话`)
      this.removeUserConversation(userConversationKey)
      return
    }

    const conversation = this.conversations[userConversation.conversationKey]
    if (!conversation) {
      this.logger.ERROR(`未找到 conversation_key ${userConversation.conversationKey} 对应的 ConversationBuilder, 已删除该 conversationKey`)
      this.removeUserConversation(userConversationKey)
      delete this.conversations[userConversation.conversationKey]
      return
    }

    const steps = conversation.getSteps()
    const step = steps[userConversation.stepIndex]
    if (!step) {
      this.logger.ERROR(`conversation ${userConversation.conversationKey} 的 stepIndex ${userConversation.stepIndex} 超出范围, 已删除该 conversationKey`)
      this.removeUserConversation(userConversationKey)
      delete this.conversations[userConversation.conversationKey]
      return
    }

    try {
      const retryCount = userConversation.retryCount + 1
      const predicatePassed = await step.predicate({ context, isLastRetry: retryCount > step.retryCount }, userConversation.data)
      if (!predicatePassed) {
        this.logger.DEBUG(`连续对话 ${userConversation.conversationKey} 的 step ${userConversation.stepIndex} 的 predicate 返回 false, 不触发callback`)
        userConversation.retryCount += 1
        if (retryCount > step.retryCount) {
          this.logger.DEBUG(`连续对话 ${userConversation.conversationKey} 的 step ${userConversation.stepIndex} 超过重试次数, 已退出连续对话`)
          this.removeUserConversation(userConversationKey)
          await this.sendMsg(context, [Structs.text('连续对话预检不通过超过重试次数, 已退出连续对话')])
          return 'quit'
        }
        this.scheduleConversationTimeout(userConversationKey, context, this.getStepTimeout(conversation, userConversation.stepIndex))
        return
      }

      userConversation.retryCount = 0
      const result = await step.callback({ context }, userConversation.data)
      if (typeof result === 'number' && result < 0) {
        const backStepIndex = userConversation.stepIndex + result
        if (backStepIndex < 0 || backStepIndex >= steps.length) {
          this.logger.ERROR(`连续对话 ${userConversation.conversationKey} 的 step ${userConversation.stepIndex} 请求回退 ${-result} 步，但目标 stepIndex ${backStepIndex} 超出范围, 已删除该 conversationKey`)
          this.removeUserConversation(userConversationKey)
          delete this.conversations[userConversation.conversationKey]
          await this.sendMsg(context, [Structs.text('连续对话回退步骤超出范围, 已退出连续对话')])
          return
        }

        this.logger.DEBUG(`连续对话 ${userConversation.conversationKey} 的 step ${userConversation.stepIndex} 请求回退 ${-result} 步, 进入 step ${backStepIndex}`)
        userConversation.stepIndex = backStepIndex
        this.scheduleConversationTimeout(userConversationKey, context, this.getStepTimeout(conversation, userConversation.stepIndex))
        return
      }

      userConversation.data = result ?? {}

      if (steps.length === userConversation.stepIndex + 1) {
        this.logger.DEBUG(`连续对话 ${userConversation.conversationKey} 已完成所有 step, 进入 resolve 阶段`)
        await conversation.getResolver()(userConversation.data, { context })
        this.removeUserConversation(userConversationKey)
        this.logger.DEBUG(`连续对话 ${userConversation.conversationKey} 已完成, 已删除该 conversationKey`)
        return 'quit'
      }

      userConversation.stepIndex += 1
      this.scheduleConversationTimeout(userConversationKey, context, this.getStepTimeout(conversation, userConversation.stepIndex))
    }
    catch (error) {
      this.logger.ERROR(`连续对话 ${userConversation.conversationKey} 的 step ${userConversation.stepIndex} 处理失败:`, error)
      await this.sendMsg(context, [
        Structs.text(`连续对话 ${userConversation.conversationKey} 的 step ${userConversation.stepIndex} 处理失败, 请联系管理员处理: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`),
      ])
      this.removeUserConversation(userConversationKey)
      return 'quit'
    }

    return 'quit'
  }

  private getStepTimeout(conversation: ConversationBuilder<any, any, any>, stepIndex: number) {
    const step = conversation.getSteps()[stepIndex]
    if (!step) {
      return null
    }
    return step.timeout ?? conversation.getOptions().defaultTimeout
  }

  private clearConversationTimeout(userKey: string) {
    const state = this.usersConversations[userKey]
    if (state?.timeoutInterval) {
      clearTimeout(state.timeoutInterval)
      state.timeoutInterval = null
    }
  }

  private removeUserConversation(userKey: string) {
    this.clearConversationTimeout(userKey)
    delete this.usersConversations[userKey]
  }

  private scheduleConversationTimeout(userKey: string, context: AnyMessageContext, timeout: number | null | undefined) {
    if (timeout === null || timeout === undefined || timeout <= 0) {
      this.clearConversationTimeout(userKey)
      return
    }

    const state = this.usersConversations[userKey]
    if (!state) {
      return
    }

    this.clearConversationTimeout(userKey)
    this.logger.DEBUG(`连续对话 ${state.conversationKey} 设置 ${timeout}ms 超时计时器`)

    const target = 'group_id' in context
      ? { message_type: 'group' as const, group_id: context.group_id, user_id: context.user_id }
      : { message_type: 'private' as const, user_id: context.user_id }

    const timer = setTimeout(() => {
      void (async () => {
        const latestState = this.usersConversations[userKey]
        if (!latestState || latestState.timeoutInterval !== timer) {
          return
        }

        this.logger.DEBUG(`连续对话 ${latestState.conversationKey} 因超时 (${timeout}ms) 已退出`)
        this.removeUserConversation(userKey)
        await this.sendMsg(target, [Structs.text('连续对话已超时, 已退出连续对话')])
      })()
    }, timeout)

    timer.unref?.()
    state.timeoutInterval = timer
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
