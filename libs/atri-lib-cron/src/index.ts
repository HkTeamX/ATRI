import { CronJob } from 'cron'

export const cronJobs: Record<string, CronJob> = {}

export type AddCronOptions = Parameters<typeof CronJob.from>[0] & { name: string }

export function addCronJob(options: AddCronOptions): [false, string] | [true, CronJob] {
  if (cronJobs[options.name]) {
    return [false, 'name already exists']
  }

  // 默认启动任务
  if (!('start' in options)) {
    options.start = true
  }

  const job = CronJob.from(options) as CronJob
  cronJobs[options.name] = job

  return [true, job]
}

export function removeCronJob(name: string) {
  const job = cronJobs[name]
  if (!job) {
    return
  }
  job.stop()
  delete cronJobs[name]
}
