import type { LogLevel } from '@huan_kong/logger'
import type { CronJob } from 'cron'

export interface CronConfig {
  debug?: boolean
  logLevel?: LogLevel
  timeZone?: string
}

export type AddCronOptions = Parameters<typeof CronJob.from>[0] & {
  onTick: () => void | Promise<void>
  name: string
}
