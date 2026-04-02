import type { NoticeHandler } from 'node-napcat-ts'
import type { MaybePromise } from '@/utils.js'

export interface NoticeContext<T extends keyof NoticeHandler> {
  context: NoticeHandler[T]
}

export interface NoticeEvent<T extends keyof NoticeHandler = keyof NoticeHandler> {
  type: 'notice'
  endPoint?: T
  priority?: number
  pluginName: string
  callback: (context: NoticeContext<T>, next: () => void) => MaybePromise<void>
}

export class ATRINotice<TEndPoint extends keyof NoticeHandler> {
  #pluginName: string
  #endPoint: TEndPoint = 'notice' as TEndPoint
  #priority?: number
  #callback: (context: NoticeContext<TEndPoint>, next: () => void) => MaybePromise<void>

  constructor(pluginName: string) {
    this.#pluginName = pluginName
    this.#callback = () => {}
  }

  endPoint<TNewEndPoint extends keyof NoticeHandler>(endPoint: TNewEndPoint): ATRINotice<TNewEndPoint> {
    this.#endPoint = endPoint as unknown as TEndPoint
    return this as unknown as ATRINotice<TNewEndPoint>
  }

  priority(priority: number): this {
    this.#priority = priority
    return this
  }

  callback(callback: (context: NoticeContext<TEndPoint>, next: () => void) => MaybePromise<void>): this {
    this.#callback = callback
    return this
  }

  build(): NoticeEvent<TEndPoint> {
    return {
      type: 'notice',
      pluginName: this.#pluginName,
      endPoint: this.#endPoint,
      priority: this.#priority,
      callback: this.#callback,
    }
  }
}
