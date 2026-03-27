import type { ATRI } from '@atri-bot/core'
import { CronJob } from 'cron'

export const cronJobs: Record<string, CronJob> = {}

export type AddCronOptions = Parameters<typeof CronJob.from>[0] & { name: string, onTick: () => Promise<void> | void }

export function useCron(atri: ATRI) {
  const logger = atri.logger.clone({
    title: 'Cron',
  })

  return {
    addCronJob(options: AddCronOptions): [false, string] | [true, CronJob] {
      if (cronJobs[options.name]) {
        return [false, 'name already exists']
      }

      // 默认启动任务
      if (!('start' in options)) {
        options.start = true
      }

      if (!('onComplete' in options)) {
        options.onComplete = () => {
          logger.DEBUG(`CronJob ${options.name} 已完成.`)
        }
      }

      options.onTick = ((originFunc) => {
        return () => {
          logger.DEBUG(`CronJob ${options.name} 执行中...`)
          originFunc()
        }
      })(options.onTick)

      const job = CronJob.from(options) as CronJob
      cronJobs[options.name] = job

      return [true, job]
    },
    removeCronJob(name: string): boolean {
      const job = cronJobs[name]
      if (!job) {
        return false
      }
      job.stop()
      delete cronJobs[name]
      return true
    },
  }
}
