import type { AddCronOptions, CronConfig } from './types/index.js'
import { Logger, LogLevel } from '@huan_kong/logger'
import { CronJob } from 'cron'

// 统一所有实例化后的 cronJobs
export const cronJobs: Record<string, CronJob> = {}

export class Cron {
  config: CronConfig
  logger: Logger

  constructor(config: CronConfig) {
    this.config = config
    this.logger = new Logger({
      title: 'Cron',
      level: config.logLevel ?? (config.debug ? LogLevel.DEBUG : undefined),
    })
  }

  add(options: AddCronOptions): [false, string] | [true, CronJob] {
    if (cronJobs[options.name]) {
      return [false, 'name already exists']
    }

    if (!('timeZone' in options)) {
      options.timeZone = this.config.timeZone ?? 'Asia/Shanghai'
    }

    options.onTick = ((originFunction) => {
      return async () => {
        this.logger.DEBUG('定时任务触发!')
        await originFunction()
      }
    })(options.onTick)

    const job = CronJob.from(options) as CronJob
    cronJobs[options.name] = job
    return [true, job]
  }

  remove(name: string): void {
    const job = cronJobs[name]
    if (job) {
      job.stop()
      delete cronJobs[name]
      this.logger.DEBUG(`定时任务 ${name} 已移除`)
    }
    else {
      this.logger.WARN(`定时任务 ${name} 不存在，无法移除`)
    }
  }
}
