import type { Command } from 'commander'
import type { MessageHandler, NoticeHandler, RequestHandler } from 'node-napcat-ts'

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
  command_name: string
  params: Opts['params']
  args: Opts['args']
}

export interface CommandEvent<
  Opts extends CommandContext = CommandContext,
  T extends keyof MessageHandler = 'message',
> {
  type: 'command'
  end_point?: T
  callback: (context: CommandCallback<Opts, T>) => CallbackReturn
  plugin_name: string
  command_name: string | RegExp
  commander?: Command
  priority?: number
  need_hide?: boolean
  need_reply?: boolean
  need_admin?: boolean
}

export interface MessageCallback<T extends keyof MessageHandler = 'message'> {
  context: MessageHandler[T]
}

export interface MessageEvent<T extends keyof MessageHandler = 'message'> {
  type: 'message'
  end_point?: T
  regexp?: RegExp
  callback: (context: MessageCallback<T>) => CallbackReturn
  plugin_name: string
  priority?: number
  need_reply?: boolean
  need_admin?: boolean
}

export interface NoticeCallback<T extends keyof NoticeHandler = 'notice'> {
  context: NoticeHandler[T]
}

export interface NoticeEvent<T extends keyof NoticeHandler = 'notice'> {
  type: 'notice'
  end_point?: T
  callback: (context: NoticeCallback<T>) => CallbackReturn
  plugin_name: string
  priority?: number
}

export interface RequestCallback<T extends keyof RequestHandler = 'request'> {
  context: RequestHandler[T]
}

export interface RequestEvent<T extends keyof RequestHandler = 'request'> {
  type: 'request'
  end_point?: T
  callback: (context: RequestCallback<T>) => CallbackReturn
  plugin_name: string
  priority?: number
}

export type RegEventOptions = CommandEvent | MessageEvent | NoticeEvent | RequestEvent
