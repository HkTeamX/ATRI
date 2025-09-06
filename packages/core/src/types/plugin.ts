import { Logger, LogLevel } from '@huan_kong/logger'
import type { Command } from 'commander'
import type { MessageHandler, NCWebsocket, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { ATRI } from '../atri.js'
import type { Bot } from '../bot.js'
import type { UnRegHandler } from './bot.js'
import type { RemoveField } from './utils.js'

export type CallbackReturnType = void | 'quit'
export type CallbackReturn = Promise<CallbackReturnType> | CallbackReturnType

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionParams = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionArgs = any[]

export interface CommandContext {
  params?: OptionParams
  args?: OptionArgs
}

export interface CommandCallback<
  Opts extends CommandContext = CommandContext,
  T extends keyof MessageHandler = 'message',
> {
  context: MessageHandler[T]
  prefix: string
  commandName: string
  params: Opts['params']
  args: Opts['args']
}

export interface CommandEvent<
  Opts extends CommandContext = CommandContext,
  T extends keyof MessageHandler = 'message',
> {
  type: 'command'
  endPoint?: T
  callback: (context: CommandCallback<Opts, T>) => CallbackReturn
  pluginName: string
  commandName: string | RegExp
  commander?: Command
  priority?: number
  needHide?: boolean
  needReply?: boolean
  needAdmin?: boolean
}

export interface MessageCallback<T extends keyof MessageHandler = 'message'> {
  context: MessageHandler[T]
}

export interface MessageEvent<T extends keyof MessageHandler = 'message'> {
  type: 'message'
  endPoint?: T
  regexp?: RegExp
  callback: (context: MessageCallback<T>) => CallbackReturn
  pluginName: string
  priority?: number
  needReply?: boolean
  needAdmin?: boolean
}

export interface NoticeCallback<T extends keyof NoticeHandler = 'notice'> {
  context: NoticeHandler[T]
}

export interface NoticeEvent<T extends keyof NoticeHandler = 'notice'> {
  type: 'notice'
  endPoint?: T
  callback: (context: NoticeCallback<T>) => CallbackReturn
  pluginName: string
  priority?: number
}

export interface RequestCallback<T extends keyof RequestHandler = 'request'> {
  context: RequestHandler[T]
}

export interface RequestEvent<T extends keyof RequestHandler = 'request'> {
  type: 'request'
  endPoint?: T
  callback: (context: RequestCallback<T>) => CallbackReturn
  pluginName: string
  priority?: number
}

export type RegEventOptions = CommandEvent | MessageEvent | NoticeEvent | RequestEvent

export type AutoInferCommandEndPoint<Opts extends CommandContext = CommandContext> = {
  [T in keyof MessageHandler]: RemoveField<CommandEvent<Opts, T>, 'pluginName' | 'type'> & {
    endPoint: T
  }
}[keyof MessageHandler]

export type AutoInferMessageEndPoint = {
  [T in keyof MessageHandler]: RemoveField<MessageEvent<T>, 'pluginName' | 'type'> & {
    endPoint: T
  }
}[keyof MessageHandler]

export type AutoInferRequestEndPoint = {
  [T in keyof RequestHandler]: RemoveField<RequestEvent<T>, 'pluginName' | 'type'> & {
    endPoint: T
  }
}[keyof RequestHandler]

export type AutoInferNoticeEndPoint = {
  [T in keyof NoticeHandler]: RemoveField<NoticeEvent<T>, 'pluginName' | 'type'> & {
    endPoint: T
  }
}[keyof NoticeHandler]

export abstract class BasePlugin<TConfig extends object = object> {
  abstract pluginName: string
  // 构造完成后自动注入
  pluginVersion!: string

  disableAutoLoadConfig?: boolean
  configName?: string
  defaultConfig?: TConfig
  config: TConfig

  atri: ATRI
  bot: Bot
  ws: NCWebsocket
  private unregHandlers: UnRegHandler[] = []

  // 构造完成后通过 initLogger 初始化
  logger!: Logger

  constructor(atri: ATRI) {
    this.atri = atri
    this.bot = atri.bot
    this.ws = atri.bot.ws
    this.config = {} as TConfig
  }

  initLogger() {
    const config = this.atri.config
    this.logger = new Logger({
      title: this.pluginName,
      level: config.debug ? LogLevel.DEBUG : config.logLevel,
    })
  }

  abstract load(): void | Promise<void>
  abstract unload(): void | Promise<void>

  setConfig(config: TConfig) {
    this.config = config
  }

  saveConfig(config?: TConfig) {
    this.atri.saveConfig(this.configName ?? this.pluginName, config ?? this.config)
  }

  getDisableAutoLoadConfig() {
    return this.disableAutoLoadConfig
  }

  getConfigName() {
    return this.configName ?? this.pluginName
  }

  getDefaultConfig(): TConfig {
    return this.defaultConfig ?? ({} as TConfig)
  }

  getUnregHandlers() {
    return this.unregHandlers
  }

  getPluginName() {
    return this.pluginName
  }

  regCommandEvent<Opts extends CommandContext = CommandContext>(
    options: AutoInferCommandEndPoint<Opts>,
  ): () => void
  regCommandEvent<Opts extends CommandContext = CommandContext>(
    options: RemoveField<CommandEvent<Opts, 'message'>, 'pluginName' | 'type'>,
  ): () => void
  regCommandEvent<Opts extends CommandContext = CommandContext>(
    options:
      | AutoInferCommandEndPoint<Opts>
      | RemoveField<CommandEvent<Opts, 'message'>, 'pluginName' | 'type'>,
  ) {
    const unreg = this.bot.regEvent({
      ...options,
      type: 'command',
      pluginName: this.pluginName,
    } as RegEventOptions)
    this.unregHandlers.push(unreg)
    return unreg
  }

  regMessageEvent(options: AutoInferMessageEndPoint): () => void
  regMessageEvent(options: RemoveField<MessageEvent<'message'>, 'pluginName' | 'type'>): () => void
  regMessageEvent(
    options: AutoInferMessageEndPoint | RemoveField<MessageEvent<'message'>, 'pluginName' | 'type'>,
  ) {
    const unreg = this.bot.regEvent({
      ...options,
      type: 'message',
      pluginName: this.pluginName,
    } as RegEventOptions)
    this.unregHandlers.push(unreg)
    return unreg
  }

  regRequestEvent(options: AutoInferRequestEndPoint): () => void
  regRequestEvent(options: RemoveField<RequestEvent<'request'>, 'pluginName' | 'type'>): () => void
  regRequestEvent(
    options: AutoInferRequestEndPoint | RemoveField<RequestEvent<'request'>, 'pluginName' | 'type'>,
  ) {
    const unreg = this.bot.regEvent({
      ...options,
      type: 'request',
      pluginName: this.pluginName,
    } as RegEventOptions)
    this.unregHandlers.push(unreg)
    return unreg
  }

  regNoticeEvent(options: AutoInferNoticeEndPoint): () => void
  regNoticeEvent(options: RemoveField<NoticeEvent<'notice'>, 'pluginName' | 'type'>): () => void
  regNoticeEvent(
    options: AutoInferNoticeEndPoint | RemoveField<NoticeEvent<'notice'>, 'pluginName' | 'type'>,
  ) {
    const unreg = this.bot.regEvent({
      ...options,
      type: 'notice',
      pluginName: this.pluginName,
    } as RegEventOptions)
    this.unregHandlers.push(unreg)
    return unreg
  }
}
