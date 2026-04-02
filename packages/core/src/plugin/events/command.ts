import type { MessageHandler } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { ATRI } from '@/atri.js'
import type { Bot } from '@/bot.js'
import type { MaybePromise } from '@/utils.js'
import yargs from 'yargs'

export interface CommandContext<T extends keyof MessageHandler, K extends Argv> {
  context: MessageHandler[T]
  options: ReturnType<K['parseSync']>
  atri: ATRI
  bot: Bot
  ws: Bot['ws']
}

export interface CommandEvent<T extends keyof MessageHandler = keyof MessageHandler, K extends Argv = Argv> {
  type: 'command'
  endPoint?: T
  trigger: string | RegExp
  priority?: number
  needReply?: boolean
  needAdmin?: boolean
  hideInHelp?: boolean
  pluginName: string
  commander?: () => K
  callback: (context: CommandContext<T, K>, next: () => void) => MaybePromise<void>
}

export class ATRICommand<TEndPoint extends keyof MessageHandler, TArgv extends Argv> {
  #pluginName: string
  #trigger: string | RegExp
  #endPoint: TEndPoint = 'message' as TEndPoint
  #priority?: number
  #needReply?: boolean
  #needAdmin?: boolean
  #hideInHelp?: boolean
  #commander: TArgv
  #callback: (context: CommandContext<TEndPoint, TArgv>, next: () => void) => MaybePromise<void>

  constructor(pluginName: string, trigger: string | RegExp) {
    this.#pluginName = pluginName
    this.#trigger = trigger
    this.#commander = yargs() as unknown as TArgv
    this.#callback = () => {}
  }

  endPoint<TNewEndPoint extends keyof MessageHandler>(endPoint: TNewEndPoint): ATRICommand<TNewEndPoint, TArgv> {
    this.#endPoint = endPoint as unknown as TEndPoint
    return this as unknown as ATRICommand<TNewEndPoint, TArgv>
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

  hideInHelp(hideInHelp = true): this {
    this.#hideInHelp = hideInHelp
    return this
  }

  commander<TNewArgv extends Argv>(commander: TNewArgv): ATRICommand<TEndPoint, TNewArgv> {
    this.#commander = commander as unknown as TArgv
    return this as unknown as ATRICommand<TEndPoint, TNewArgv>
  }

  callback(callback: (context: CommandContext<TEndPoint, TArgv>, next: () => void) => MaybePromise<void>): this {
    this.#callback = callback
    return this
  }

  build(): CommandEvent<TEndPoint, TArgv> {
    return {
      type: 'command',
      pluginName: this.#pluginName,
      trigger: this.#trigger,
      endPoint: this.#endPoint,
      priority: this.#priority,
      needReply: this.#needReply,
      needAdmin: this.#needAdmin,
      hideInHelp: this.#hideInHelp,
      commander: () => this.#commander,
      callback: this.#callback,
    }
  }
}
