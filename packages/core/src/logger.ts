import util from 'node:util'
import pc from 'picocolors'
import { get_date_time, is_object } from './utils.js'

export class Logger {
  prefix: string
  debug: boolean

  constructor(prefix: string, debug = false) {
    this.prefix = prefix
    this.debug = debug
  }

  INFO(...messages: unknown[]) {
    this.print(pc.blue(`[INFO]`), ...messages)
  }

  SUCCESS(...messages: unknown[]) {
    this.print(pc.green(`[SUCCESS]`), ...messages)
  }

  ERROR(...messages: unknown[]) {
    this.print(pc.red(`[ERROR]`), ...messages)
  }

  DEBUG(...messages: unknown[]) {
    if (!this.debug) return
    this.print(pc.magenta(`[DEBUG]`), ...messages)
  }

  private formatMessages = (messages: unknown[]): string[] => {
    return messages.map((item) => {
      try {
        return typeof item === 'string' ? JSON.parse(item) : item
      } catch {
        return item
      }
    })
  }

  private print(...messages: unknown[]) {
    if (typeof messages === 'string') messages = [messages]
    messages = messages.map((message) =>
      is_object(message) || Array.isArray(message)
        ? util.inspect(message, { depth: null, colors: true })
        : message,
    )

    const message = [pc.cyan(`[${get_date_time()}]`)]
    if (this.prefix) message.push(pc.yellow(`[${this.prefix}]`))
    message.push(...this.formatMessages(messages))

    console.log(...message)
  }
}
