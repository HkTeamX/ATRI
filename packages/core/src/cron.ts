import type { Logger, LogLevelType } from '@huan_kong/logger'
import type { ATRI } from './atri.js'
import { CronJob } from 'cron'

// 所有实例化后的 cronJobs
export const cronJobs: Record<string, CronJob> = {}

export interface CronConfig {
  timeZone?: string
  logLevel?: LogLevelType
}

export type AddCronOptions = Parameters<typeof CronJob.from>[0] & { name: string }

export class Cron {
  config: CronConfig
  logger: Logger

  constructor(atri: ATRI, config: CronConfig) {
    this.logger = atri.logger.clone({
      title: 'Cron',
      level: config.logLevel,
    })
    this.config = config
  }

  add(options: AddCronOptions) {
    if (cronJobs[options.name]) {
      return [false, 'name already exists']
    }

    if (!('timeZone' in options)) {
      options.timeZone = this.config.timeZone ?? 'Asia/Shanghai'
    }

    const job = CronJob.from(options) as CronJob
    cronJobs[options.name] = job

    return [true, job]
  }

  remove(name: string) {
    const job = cronJobs[name]
    if (!job) {
      return
    }

    job.stop()
    delete cronJobs[name]
  }
}
