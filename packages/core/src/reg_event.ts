import type { Command, OptionValues } from 'commander'
import type { MessageHandler, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { WithDefault } from './utils.js'

export type _CallbackReturnType = void | 'quit'
export type CallbackReturnType = Promise<_CallbackReturnType> | _CallbackReturnType

export interface CommandContext {
  params?: OptionValues
  args?: any[]
}

export interface CommandCallback<
  Opts extends CommandContext = {},
  T extends keyof MessageHandler = 'message',
> {
  context: MessageHandler[T]
  prefix: string
  command_name: string
  params: WithDefault<Opts['params'], object>
  args: WithDefault<Opts['args'], any[]>
}

export interface CommandEvent<
  Opts extends CommandContext = {},
  T extends keyof MessageHandler = 'message',
> {
  type: 'command'
  end_point?: T
  callback: (context: CommandCallback<Opts, T>) => CallbackReturnType
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
  callback: (context: MessageCallback<T>) => CallbackReturnType
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
  callback: (context: NoticeCallback<T>) => CallbackReturnType
  plugin_name: string
  priority?: number
}

export interface RequestCallback<T extends keyof RequestHandler = 'request'> {
  context: RequestHandler[T]
}

export interface RequestEvent<T extends keyof RequestHandler = 'request'> {
  type: 'request'
  end_point?: T
  callback: (context: RequestCallback<T>) => CallbackReturnType
  plugin_name: string
  priority?: number
}

export type RegEventOptions = CommandEvent | MessageEvent | NoticeEvent | RequestEvent
