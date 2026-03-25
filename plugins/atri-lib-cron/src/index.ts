import { definePlugin } from '@atri-bot/core'
import { CronJob } from 'cron'
import packageJson from '../package.json' with { type: 'json' }

// 所有实例化后的 cronJobs
const cronJobs: Record<string, CronJob> = {}

export interface CronConfig {
  timeZone?: string
}

export type AddCronOptions = Parameters<typeof CronJob.from>[0] & { name: string }

export interface CronPluginProps {
  cronJobs: Record<string, CronJob>
  add: (options: AddCronOptions) => [false, string] | [true, CronJob]
  remove: (name: string) => void
}

export function Plugin(config?: CronConfig) {
  return definePlugin<CronPluginProps, CronConfig>({
    pluginName: packageJson.name,
    defaultConfig: { timeZone: 'Asia/Shanghai' },
    config,
    install() {},
    uninstall() {},

    cronJobs,
    add(options) {
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

    remove(name) {
      const job = cronJobs[name]
      if (!job) {
        return
      }

      job.stop()
      delete cronJobs[name]
    },
  })
}
