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

  reg_command_event<T extends keyof MessageHandler, Opts extends CommandContext>(
    options: RemoveField<CommandEvent<T, Opts>, 'plugin_name' | 'type'>,
  ) {
    return this.bot.reg_event({
      ...options,
      type: 'command',
      plugin_name: this.name,
    } as RegEventOptions)
  }

  reg_message_event<T extends keyof MessageHandler>(
    options: RemoveField<MessageEvent<T>, 'plugin_name' | 'type'>,
  ) {
    return this.bot.reg_event({
      ...options,
      type: 'message',
      plugin_name: this.name,
    } as RegEventOptions)
  }

  reg_request_event<T extends keyof RequestHandler>(
    options: RemoveField<RequestEvent<T>, 'plugin_name' | 'type'>,
  ) {
    return this.bot.reg_event({
      ...options,
      type: 'request',
      plugin_name: this.name,
    } as RegEventOptions)
  }

  reg_notice_event<T extends keyof NoticeHandler>(
    options: RemoveField<NoticeEvent<T>, 'plugin_name' | 'type'>,
  ) {
    return this.bot.reg_event({
      ...options,
      type: 'notice',
      plugin_name: this.name,
    } as RegEventOptions)
  }
}
