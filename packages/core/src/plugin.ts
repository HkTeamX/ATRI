import type { MessageHandler, NCWebsocket, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { ATRI } from './atri.js'
import type { Bot } from './bot.js'
import type {
  CommandContext,
  CommandEvent,
  MessageEvent,
  NoticeEvent,
  RegEventOptions,
  RequestEvent,
} from './reg_event.js'
import type { RemoveField } from './utils.js'

export type AutoInferCommandEndPoint<Opts extends CommandContext = CommandContext> = {
  [T in keyof MessageHandler]: RemoveField<CommandEvent<Opts, T>, 'plugin_name' | 'type'> & {
    end_point: T
  }
}[keyof MessageHandler]

export type AutoInferMessageEndPoint = {
  [T in keyof MessageHandler]: RemoveField<MessageEvent<T>, 'plugin_name' | 'type'> & {
    end_point: T
  }
}[keyof MessageHandler]

export type AutoInferRequestEndPoint = {
  [T in keyof RequestHandler]: RemoveField<RequestEvent<T>, 'plugin_name' | 'type'> & {
    end_point: T
  }
}[keyof RequestHandler]

export type AutoInferNoticeEndPoint = {
  [T in keyof NoticeHandler]: RemoveField<NoticeEvent<T>, 'plugin_name' | 'type'> & {
    end_point: T
  }
}[keyof NoticeHandler]

export abstract class BasePlugin<TConfig = object> {
  abstract name: string
  abstract version: string
  dependencies?: { [key: string]: string }

  auto_load_config?: boolean
  config_name?: string
  default_config?: TConfig
  config!: TConfig extends object ? TConfig : undefined

  atri!: ATRI
  bot!: Bot
  ws!: NCWebsocket

  constructor(atri: ATRI) {
    this.atri = atri
    this.bot = atri.bot
    this.ws = atri.bot.ws
  }

  abstract init(): void | Promise<void>

  reg_command_event<Opts extends CommandContext = CommandContext>(
    options: AutoInferCommandEndPoint<Opts>,
  ): void
  reg_command_event<Opts extends CommandContext = CommandContext>(
    options: RemoveField<CommandEvent<Opts, 'message'>, 'plugin_name' | 'type'>,
  ): void
  reg_command_event<Opts extends CommandContext = CommandContext>(
    options:
      | AutoInferCommandEndPoint<Opts>
      | RemoveField<CommandEvent<Opts, 'message'>, 'plugin_name' | 'type'>,
  ) {
    return this.bot.reg_event({
      ...options,
      type: 'command',
      plugin_name: this.name,
    } as RegEventOptions)
  }

  reg_message_event(options: AutoInferMessageEndPoint): void
  reg_message_event(options: RemoveField<MessageEvent<'message'>, 'plugin_name' | 'type'>): void
  reg_message_event(
    options:
      | AutoInferMessageEndPoint
      | RemoveField<MessageEvent<'message'>, 'plugin_name' | 'type'>,
  ) {
    return this.bot.reg_event({
      ...options,
      type: 'message',
      plugin_name: this.name,
    } as RegEventOptions)
  }

  reg_request_event(options: AutoInferRequestEndPoint): void
  reg_request_event(options: RemoveField<RequestEvent<'request'>, 'plugin_name' | 'type'>): void
  reg_request_event(
    options:
      | AutoInferRequestEndPoint
      | RemoveField<RequestEvent<'request'>, 'plugin_name' | 'type'>,
  ) {
    return this.bot.reg_event({
      ...options,
      type: 'request',
      plugin_name: this.name,
    } as RegEventOptions)
  }

  reg_notice_event(options: AutoInferNoticeEndPoint): void
  reg_notice_event(options: RemoveField<NoticeEvent<'notice'>, 'plugin_name' | 'type'>): void
  reg_notice_event(
    options: AutoInferNoticeEndPoint | RemoveField<NoticeEvent<'notice'>, 'plugin_name' | 'type'>,
  ) {
    return this.bot.reg_event({
      ...options,
      type: 'notice',
      plugin_name: this.name,
    } as RegEventOptions)
  }
}
