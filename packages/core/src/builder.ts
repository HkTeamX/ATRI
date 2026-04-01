import type { MessageHandler } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { CommandContext, MessageContext } from './bot.js'
import type { MaybePromise } from './utils.js'

export interface ConversationOptions {
  defaultTimeout?: number
  defaultRetryCount?: number
  /** 全局唯一注册ID */
  conversationKey: string
  /** 退出对话的命令词，默认为 '退出' */
  exitCommand?: string
  /** 超时前多少毫秒发送警告，默认为 10000ms */
  timeoutWarningMs?: number
}

export interface ConversationStepOptions<TEndPoint extends keyof MessageHandler, TData extends object = object, TNewData extends object = object> {
  callback: (context: MessageContext<TEndPoint>, data: TData) => MaybePromise<TNewData | null>
  predicate?: (context: MessageContext<TEndPoint> & { isLastRetry: boolean }, data: TData) => MaybePromise<boolean>
  /** 步骤异常时的处理器，返回 true 继续对话，false 退出对话 */
  onError?: (context: MessageContext<TEndPoint>, error: Error, data: TData) => MaybePromise<boolean>
  timeout?: number
  retryCount?: number
}

export type ConversationHandler<TEndPoint extends keyof MessageHandler, TArgv extends Argv, TData extends object> = (context: CommandContext<TEndPoint, TArgv>) => MaybePromise<void | 'quit' | TData>

export class ConversationBuilder<TEndPoint extends keyof MessageHandler = 'message', TArgv extends Argv = Argv, TData extends object = object> {
  private steps: Required<ConversationStepOptions<TEndPoint, TData, any>>[]
  private handler: ConversationHandler<TEndPoint, TArgv, any>
  private resolver: (data: TData, context: MessageContext<TEndPoint>) => MaybePromise<void>
  private options: Required<ConversationOptions>

  constructor(options: ConversationOptions | string) {
    this.options = {
      defaultTimeout: 30 * 1000,
      defaultRetryCount: 3,
      exitCommand: '退出',
      timeoutWarningMs: 10000,
      ...typeof options === 'string' ? { conversationKey: options } : options,
    }
    this.steps = []
    this.handler = () => {}
    this.resolver = () => {}
  }

  handle<TNewData extends object>(fn: ConversationHandler<TEndPoint, TArgv, TNewData>): ConversationBuilder<TEndPoint, TArgv, TNewData> {
    this.handler = fn
    return this as any
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
      onError: () => false,
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
