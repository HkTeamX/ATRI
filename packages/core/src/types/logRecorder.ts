import type { LogLevel } from '@huan_kong/logger'

export type LogRecorderConfig = {
  enable?: boolean
  maxFiles?: number
  logLevel?: LogLevel
  logDir?: string
}
