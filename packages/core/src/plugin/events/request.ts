import type { RequestHandler } from 'node-napcat-ts'
import type { ATRI } from '@/atri.js'
import type { Bot } from '@/bot.js'
import type { MaybePromise } from '@/utils.js'

export interface RequestContext<T extends keyof RequestHandler> {
  context: RequestHandler[T]
  atri: ATRI
  bot: Bot
  ws: Bot['ws']
}

export interface RequestEvent<T extends keyof RequestHandler = keyof RequestHandler> {
  type: 'request'
  endPoint?: T
  priority?: number
  pluginName: string
  callback: (context: RequestContext<T>, next: () => void) => MaybePromise<void>
}

export class ATRIRequest<TEndPoint extends keyof RequestHandler> {
  #pluginName: string
  #endPoint: TEndPoint = 'request' as TEndPoint
  #priority?: number
  #callback: (context: RequestContext<TEndPoint>, next: () => void) => MaybePromise<void>

  constructor(pluginName: string) {
    this.#pluginName = pluginName
    this.#callback = () => {}
  }

  endPoint<TNewEndPoint extends keyof RequestHandler>(endPoint: TNewEndPoint): ATRIRequest<TNewEndPoint> {
    this.#endPoint = endPoint as unknown as TEndPoint
    return this as unknown as ATRIRequest<TNewEndPoint>
  }

  priority(priority: number): this {
    this.#priority = priority
    return this
  }

  callback(callback: (context: RequestContext<TEndPoint>, next: () => void) => MaybePromise<void>): this {
    this.#callback = callback
    return this
  }

  build(): RequestEvent<TEndPoint> {
    return {
      type: 'request',
      pluginName: this.#pluginName,
      endPoint: this.#endPoint,
      priority: this.#priority,
      callback: this.#callback,
    }
  }
}
