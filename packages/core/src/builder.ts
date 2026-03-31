import type { MessageHandler } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { CommandContext, MessageContext } from './bot.js'
import type { MaybePromise } from './utils.js'

export interface ConversationOptions {
  defaultTimeout?: number
  defaultRetryCount?: number
  /** 全局唯一注册ID */
  conversationKey: string
}

export interface ConversationStepOptions<TEndPoint extends keyof MessageHandler, TData extends object = object, TNewData extends object = object> {
  callback: (context: MessageContext<TEndPoint>, data: TData) => MaybePromise<TNewData | null>
  predicate?: (msg: string, data: TData) => boolean
  timeout?: number
  retryCount?: number
}

export type ConversationHandler<TEndPoint extends keyof MessageHandler, TArgv extends Argv> = (context: CommandContext<TEndPoint, TArgv>) => MaybePromise<void | 'quit'>

export class ConversationBuilder<TEndPoint extends keyof MessageHandler = 'message', TArgv extends Argv = Argv, TData extends object = object> {
  private steps: Required<ConversationStepOptions<TEndPoint, TData, any>>[]
  private handler: ConversationHandler<TEndPoint, TArgv>
  private resolver: (data: TData, context: MessageContext<TEndPoint>) => MaybePromise<void>
  private options: Required<ConversationOptions>

  constructor(options: ConversationOptions | string) {
    this.options = {
      defaultTimeout: 30 * 1000,
      defaultRetryCount: 3,
      ...typeof options === 'string' ? { conversationKey: options } : options,
    }
    this.steps = []
    this.handler = () => {}
    this.resolver = () => {}
  }

  handle(fn: ConversationHandler<TEndPoint, TArgv>): this {
    this.handler = fn
    return this
  }

  resolve(fn: (data: TData, context: MessageContext<TEndPoint>) => MaybePromise<void>): this {
    this.resolver = fn
    return this
  }

  step<TNewData extends object>(options: ConversationStepOptions<TEndPoint, TData, TNewData> | ConversationStepOptions<TEndPoint, TData, TNewData>['callback']): ConversationBuilder<TEndPoint, TArgv, TNewData> {
    const currentStepOption = typeof options === 'function' ? { callback: options } : options
    this.steps.push({
      timeout: this.options.defaultTimeout,
      retryCount: this.options.defaultRetryCount,
      predicate: () => true,
      ...currentStepOption,
    })
    return this as any
  }

  getSteps() {
    return this.steps
  }

  getHandler() {
    return this.handler
  }

  getResolver() {
    return this.resolver
  }

  getOptions() {
    return this.options
  }
}
