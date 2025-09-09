import { Logger, LogLevel } from '@huan_kong/logger'
import type { Command } from 'commander'
import type { MessageHandler, NCWebsocket, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { ATRI } from '../atri.js'
import type { Bot } from '../bot.js'
import type { UnRegHandler } from './bot.js'
import type { RemoveField } from './utils.js'

export interface PackageJson {
  name: string
  version: string
  [key: string]: unknown
}

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
  packageName: string
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
  packageName: string
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
  packageName: string
  priority?: number
}

export interface RequestCallback<T extends keyof RequestHandler = 'request'> {
  context: RequestHandler[T]
}

export interface RequestEvent<T extends keyof RequestHandler = 'request'> {
  type: 'request'
  endPoint?: T
  callback: (context: RequestCallback<T>) => CallbackReturn
  packageName: string
  priority?: number
}

export type RegEventOptions = CommandEvent | MessageEvent | NoticeEvent | RequestEvent

export type AutoInferCommandEndPoint<Opts extends CommandContext = CommandContext> = {
  [T in keyof MessageHandler]: RemoveField<CommandEvent<Opts, T>, 'packageName' | 'type'> & {
    endPoint: T
  }
}[keyof MessageHandler]

export type AutoInferMessageEndPoint = {
  [T in keyof MessageHandler]: RemoveField<MessageEvent<T>, 'packageName' | 'type'> & {
    endPoint: T
  }
}[keyof MessageHandler]

export type AutoInferRequestEndPoint = {
  [T in keyof RequestHandler]: RemoveField<RequestEvent<T>, 'packageName' | 'type'> & {
    endPoint: T
  }
}[keyof RequestHandler]

export type AutoInferNoticeEndPoint = {
  [T in keyof NoticeHandler]: RemoveField<NoticeEvent<T>, 'packageName' | 'type'> & {
    endPoint: T
  }
}[keyof NoticeHandler]

export abstract class BasePlugin<TConfig extends object = object> {
  packageJson: PackageJson

  disableAutoLoadConfig?: boolean
  configName?: string
  defaultConfig?: TConfig
  config: TConfig

  atri: ATRI
  bot: Bot
  ws: NCWebsocket
  unregHandlers: UnRegHandler[] = []

  logger: Logger

  constructor(atri: ATRI, packageJson: PackageJson) {
    this.atri = atri
    this.bot = atri.bot
    this.ws = atri.bot.ws
    this.config = {} as TConfig
    this.packageJson = packageJson
    this.logger = new Logger({
      title: this.packageJson.name,
      level: atri.config.debug ? LogLevel.DEBUG : atri.config.logLevel,
    })
  }

  abstract load(): void | Promise<void>
  abstract unload(): void | Promise<void>

  saveConfig(config?: TConfig) {
    this.atri.saveConfig(this.configName ?? this.packageJson.name, config ?? this.config)
  }

  regCommandEvent<Opts extends CommandContext = CommandContext>(
    options: AutoInferCommandEndPoint<Opts>,
  ): () => void
  regCommandEvent<Opts extends CommandContext = CommandContext>(
    options: RemoveField<CommandEvent<Opts, 'message'>, 'packageName' | 'type'>,
  ): () => void
  regCommandEvent<Opts extends CommandContext = CommandContext>(
    options:
      | AutoInferCommandEndPoint<Opts>
      | RemoveField<CommandEvent<Opts, 'message'>, 'packageName' | 'type'>,
  ) {
    const unreg = this.bot.regEvent({
      ...options,
      type: 'command',
      packageName: this.packageJson.name,
    } as RegEventOptions)
    this.unregHandlers.push(unreg)
    return unreg
  }

  regMessageEvent(options: AutoInferMessageEndPoint): () => void
  regMessageEvent(options: RemoveField<MessageEvent<'message'>, 'packageName' | 'type'>): () => void
  regMessageEvent(
    options:
      | AutoInferMessageEndPoint
      | RemoveField<MessageEvent<'message'>, 'packageName' | 'type'>,
  ) {
    const unreg = this.bot.regEvent({
      ...options,
      type: 'message',
      packageName: this.packageJson.name,
    } as RegEventOptions)
    this.unregHandlers.push(unreg)
    return unreg
  }

  regRequestEvent(options: AutoInferRequestEndPoint): () => void
  regRequestEvent(options: RemoveField<RequestEvent<'request'>, 'packageName' | 'type'>): () => void
  regRequestEvent(
    options:
      | AutoInferRequestEndPoint
      | RemoveField<RequestEvent<'request'>, 'packageName' | 'type'>,
  ) {
    const unreg = this.bot.regEvent({
      ...options,
      type: 'request',
      packageName: this.packageJson.name,
    } as RegEventOptions)
    this.unregHandlers.push(unreg)
    return unreg
  }

  regNoticeEvent(options: AutoInferNoticeEndPoint): () => void
  regNoticeEvent(options: RemoveField<NoticeEvent<'notice'>, 'packageName' | 'type'>): () => void
  regNoticeEvent(
    options: AutoInferNoticeEndPoint | RemoveField<NoticeEvent<'notice'>, 'packageName' | 'type'>,
  ) {
    const unreg = this.bot.regEvent({
      ...options,
      type: 'notice',
      packageName: this.packageJson.name,
    } as RegEventOptions)
    this.unregHandlers.push(unreg)
    return unreg
  }
}
