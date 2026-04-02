import type { MessageHandler } from 'node-napcat-ts'
import type { MaybePromise } from '@/utils.js'

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
  callback: (context: MessageContext<T>, next: () => void) => MaybePromise<void>
}

export class ATRIMessage<TEndPoint extends keyof MessageHandler> {
  #pluginName: string
  #trigger?: string | RegExp
  #endPoint: TEndPoint = 'message' as TEndPoint
  #priority?: number
  #needReply?: boolean
  #needAdmin?: boolean
  #callback: (context: MessageContext<TEndPoint>, next: () => void) => MaybePromise<void>

  constructor(pluginName: string, trigger?: string | RegExp) {
    this.#pluginName = pluginName
    this.#trigger = trigger
    this.#callback = () => {}
  }

  trigger(trigger: string | RegExp): this {
    this.#trigger = trigger
    return this
  }

  endPoint<TNewEndPoint extends keyof MessageHandler>(endPoint: TNewEndPoint): ATRIMessage<TNewEndPoint> {
    this.#endPoint = endPoint as unknown as TEndPoint
    return this as unknown as ATRIMessage<TNewEndPoint>
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

  callback(callback: (context: MessageContext<TEndPoint>, next: () => void) => MaybePromise<void>): this {
    this.#callback = callback
    return this
  }

  build(): MessageEvent<TEndPoint> {
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
