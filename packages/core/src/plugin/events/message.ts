import type { Logger } from '@huan_kong/logger'
import type { MessageHandler } from 'node-napcat-ts'
import type { ATRI } from '@/atri.js'
import type { Bot } from '@/bot.js'
import type { MaybePromise } from '@/utils.js'

export interface MessageContext<T extends keyof MessageHandler, TConfig extends object> {
  context: MessageHandler[T]
  config: TConfig
  atri: ATRI
  bot: Bot
  ws: Bot['ws']
  logger: Logger
  refreshConfig: () => Promise<TConfig>
  saveConfig: (config?: TConfig) => Promise<void>
}

export interface MessageEvent<T extends keyof MessageHandler = keyof MessageHandler, TConfig extends object = object> {
  type: 'message'
  endPoint?: T
  trigger?: string | RegExp
  priority?: number
  needReply?: boolean
  needAdmin?: boolean
  pluginName: string
  callback: (context: MessageContext<T, TConfig>, next: () => void) => MaybePromise<void>
}

export const messageSymbol = Symbol.for('atri_message')

export class ATRIMessage<TEndPoint extends keyof MessageHandler, TConfig extends object> {
  #pluginName: string
  #trigger?: string | RegExp
  #endPoint: TEndPoint = 'message' as TEndPoint
  #priority?: number
  #needReply?: boolean
  #needAdmin?: boolean
  #callback: (context: MessageContext<TEndPoint, TConfig>, next: () => void) => MaybePromise<void>
  symbol = messageSymbol

  constructor(pluginName: string, trigger?: string | RegExp) {
    this.#pluginName = pluginName
    this.#trigger = trigger
    this.#callback = () => {}
  }

  trigger(trigger: string | RegExp): this {
    this.#trigger = trigger
    return this
  }

  endPoint<TNewEndPoint extends keyof MessageHandler>(endPoint: TNewEndPoint): ATRIMessage<TNewEndPoint, TConfig> {
    this.#endPoint = endPoint as unknown as TEndPoint
    return this as unknown as ATRIMessage<TNewEndPoint, TConfig>
  }

  priority(priority: number): this {
    this.#priority = priority
    return this
  }

  needReply(needReply = true): this {
    this.#needReply = needReply
    return this
  }

  needAdmin(needAdmin = true): this {
    this.#needAdmin = needAdmin
    return this
  }

  callback(callback: (context: MessageContext<TEndPoint, TConfig>, next: () => void) => MaybePromise<void>): this {
    this.#callback = callback
    return this
  }

  build(): MessageEvent<TEndPoint, TConfig> {
    return {
      type: 'message',
      pluginName: this.#pluginName,
      trigger: this.#trigger,
      endPoint: this.#endPoint,
      priority: this.#priority,
      needReply: this.#needReply,
      needAdmin: this.#needAdmin,
      callback: this.#callback,
    }
  }
}
