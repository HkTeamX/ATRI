import type { LogLevelType } from '@huan_kong/logger'
import type { BotConfig } from './bot.js'
import path from 'node:path'
import { defaultTransformer, Logger, saveFileTransformer } from '@huan_kong/logger'
import fs from 'fs-extra'
import PackageJson from '../package.json' with { type: 'json' }
import { Bot } from './bot.js'

export interface ATRIConfig {
  disableATRIFlag?: boolean

  logLevel?: LogLevelType
  configDir: string
  dataDir: string

  logDir: string
  saveLogs: boolean
  maxFiles?: number

  botConfig: BotConfig
}

export class ATRI {
  version = PackageJson.version
  config: ATRIConfig
  logger: Logger
  bot: Bot

  private async removeUselessLogs() {
    const files = await Array.fromAsync(fs.promises.glob(`${this.config.logDir}/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*.log`))
    const maxFiles = this.config.maxFiles ?? 30

    if (files.length <= maxFiles)
      return

    const filesToDeleteCount = files.length - maxFiles + 1

    files
      .sort()
      .slice(0, filesToDeleteCount)
      .map(file => fs.promises.rm(path.join(this.config.logDir, file)).catch())
  }

  constructor(config: ATRIConfig) {
    this.config = config
    this.logger = new Logger({
      title: 'ATRI',
      level: config.logLevel,
      transformers: [
        defaultTransformer,
        ...(this.config.saveLogs
          ? [
              saveFileTransformer({
                filename: () => {
                  this.removeUselessLogs()

                  return `./logs/${new Date().toISOString().slice(0, 10)}.log`
                },
              }),
            ]
          : []),
      ],
    })
    this.bot = new Bot(this, {
      logLevel: config.logLevel,
      ...config.botConfig,
    })
  }

  async init() {
    if (!this.config.disableATRIFlag) {
      console.log('\x1Bc')
      console.log(
        `%c              __               .__
  _____     _/  |_   _______   |__|
  \\__  \\    \\   __\\  \\_  __ \\  |  |
   / __ \\_   |  |     |  | \\/  |  |
  (____  /   |__|     |__|     |__|
       \\/`,
        `font-family: Consolas;`,
      )
      this.logger.INFO(`アトリは、高性能ですから！`)
    }

    await this.bot.init()

    this.logger.INFO(`ATRI 初始化完成`)
  }
}
