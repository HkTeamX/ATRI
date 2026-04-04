import type { Logger } from '@huan_kong/logger'
import type { RequestHandler } from 'node-napcat-ts'
import type { ATRI } from '@/atri.js'
import type { Bot } from '@/bot.js'
import type { MaybePromise } from '@/utils.js'

export interface RequestContext<T extends keyof RequestHandler, TConfig extends object> {
  context: RequestHandler[T]
  config: TConfig
  atri: ATRI
  bot: Bot
  ws: Bot['ws']
  logger: Logger
  refreshConfig: () => Promise<TConfig>
  saveConfig: (config?: TConfig) => Promise<void>
}

export interface RequestEvent<T extends keyof RequestHandler = keyof RequestHandler, TConfig extends object = object> {
  type: 'request'
  endPoint?: T
  priority?: number
  pluginName: string
  callback: (context: RequestContext<T, TConfig>, next: () => void) => MaybePromise<void>
}

export const requestSymbol = Symbol.for('atri_request')

export class ATRIRequest<TEndPoint extends keyof RequestHandler, TConfig extends object> {
  #pluginName: string
  #endPoint: TEndPoint = 'request' as TEndPoint
  #priority?: number
  #callback: (context: RequestContext<TEndPoint, TConfig>, next: () => void) => MaybePromise<void>
  symbol = requestSymbol

  constructor(pluginName: string) {
    this.#pluginName = pluginName
    this.#callback = () => {}
  }

  endPoint<TNewEndPoint extends keyof RequestHandler>(endPoint: TNewEndPoint): ATRIRequest<TNewEndPoint, TConfig> {
    this.#endPoint = endPoint as unknown as TEndPoint
    return this as unknown as ATRIRequest<TNewEndPoint, TConfig>
  }

  priority(priority: number): this {
    this.#priority = priority
    return this
  }

  callback(callback: (context: RequestContext<TEndPoint, TConfig>, next: () => void) => MaybePromise<void>): this {
    this.#callback = callback
    return this
  }

  build(): RequestEvent<TEndPoint, TConfig> {
    return {
      type: 'request',
      pluginName: this.#pluginName,
      endPoint: this.#endPoint,
      priority: this.#priority,
      callback: this.#callback,
    }
  }
}
