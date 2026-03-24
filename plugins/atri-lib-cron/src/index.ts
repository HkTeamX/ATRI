import { definePlugin } from '@atri-bot/core'
import { CronJob } from 'cron'
import packageJson from '../package.json' with { type: 'json' }

// 所有实例化后的 cronJobs
const cronJobs: Record<string, CronJob> = {}

export interface CronConfig {
  timeZone?: string
}

export type AddCronOptions = Parameters<typeof CronJob.from>[0] & { name: string }

export function CronPlugin(config: CronConfig) {
  return definePlugin({
    pluginName: packageJson.name,
    config,
    install() {},
    uninstall() {},

    getCronJobs() {
      return cronJobs
    },
    add(options: AddCronOptions): [false, string] | [true, CronJob] {
      if (cronJobs[options.name]) {
        return [false, 'name already exists']
      }

      if (!('timeZone' in options)) {
        options.timeZone = this.config.timeZone ?? 'Asia/Shanghai'
      }

      const job = CronJob.from(options) as CronJob
      cronJobs[options.name] = job

      return [true, job]
    },

    remove(name: string): void {
      const job = cronJobs[name]
      if (!job) {
        return
      }

      job.stop()
      delete cronJobs[name]
    },
  })
}
