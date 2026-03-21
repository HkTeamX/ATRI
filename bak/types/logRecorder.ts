import type { LogLevel } from '@huan_kong/logger'

export interface LogRecorderConfig {
  enable?: boolean
  maxFiles?: number
  logLevel?: LogLevel
  logDir?: string
}
