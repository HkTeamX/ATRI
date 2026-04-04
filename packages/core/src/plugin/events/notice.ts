import type { Logger } from '@huan_kong/logger'
import type { NoticeHandler } from 'node-napcat-ts'
import type { ATRI } from '@/atri.js'
import type { Bot } from '@/bot.js'
import type { MaybePromise } from '@/utils.js'

export interface NoticeContext<T extends keyof NoticeHandler, TConfig extends object> {
  context: NoticeHandler[T]
  config: TConfig
  atri: ATRI
  bot: Bot
  ws: Bot['ws']
  logger: Logger
  refreshConfig: () => Promise<TConfig>
  saveConfig: (config?: TConfig) => Promise<void>
}

export interface NoticeEvent<T extends keyof NoticeHandler = keyof NoticeHandler, TConfig extends object = object> {
  type: 'notice'
  endPoint?: T
  priority?: number
  pluginName: string
  callback: (context: NoticeContext<T, TConfig>, next: () => void) => MaybePromise<void>
}

export const noticeSymbol = Symbol.for('atri_notice')

export class ATRINotice<TEndPoint extends keyof NoticeHandler, TConfig extends object> {
  #pluginName: string
  #endPoint: TEndPoint = 'notice' as TEndPoint
  #priority?: number
  #callback: (context: NoticeContext<TEndPoint, TConfig>, next: () => void) => MaybePromise<void>
  symbol = noticeSymbol

  constructor(pluginName: string) {
    this.#pluginName = pluginName
    this.#callback = () => {}
  }

  endPoint<TNewEndPoint extends keyof NoticeHandler>(endPoint: TNewEndPoint): ATRINotice<TNewEndPoint, TConfig> {
    this.#endPoint = endPoint as unknown as TEndPoint
    return this as unknown as ATRINotice<TNewEndPoint, TConfig>
  }

  priority(priority: number): this {
    this.#priority = priority
    return this
  }

  callback(callback: (context: NoticeContext<TEndPoint, TConfig>, next: () => void) => MaybePromise<void>): this {
    this.#callback = callback
    return this
  }

  build(): NoticeEvent<TEndPoint, TConfig> {
    return {
      type: 'notice',
      pluginName: this.#pluginName,
      endPoint: this.#endPoint,
      priority: this.#priority,
      callback: this.#callback,
    }
  }
}
