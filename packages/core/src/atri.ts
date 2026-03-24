import type { LogLevelType } from '@huan_kong/logger'
import type { BotConfig } from './bot.js'
import type { definePluginReturnType, Plugin } from './plugin.js'
import path from 'node:path'
import { defaultTransformer, Logger, saveFileTransformer } from '@huan_kong/logger'
import fs from 'fs-extra'
import PackageJson from '../package.json' with { type: 'json' }
import { Bot } from './bot.js'
import { normalizePluginName } from './utils.js'

export interface ATRIConfig {
  logLevel?: LogLevelType
  botConfig: BotConfig
  configDir: string
  logDir: string
  dataDir: string
  saveLogs: boolean
  maxFiles?: number
  disableATRIFlag?: boolean
  plugins?: definePluginReturnType<any, any>[]
}

export class ATRI {
  version = PackageJson.version
  config: ATRIConfig
  logger: Logger
  bot: Bot
  plugins: { [key: string]: Plugin<any, any> } = {}
  configs: { [key: string]: any } = {}

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

    for (const plugin of this.config.plugins ?? []) {
      await this.installPlugin(plugin)
    }

    this.logger.INFO(`ATRI 初始化完成`)
  }

  async installPlugin<TExtraFields extends object, TConfig extends object>(plugin: definePluginReturnType<TExtraFields, TConfig>) {
    const pluginInstance = await plugin(this)
    if (pluginInstance.pluginName in this.plugins) {
      this.logger.WARN(`插件 ${pluginInstance.pluginName} 已经安装，跳过本次安装`)
      return
    }

    await pluginInstance.install()
    this.plugins[pluginInstance.pluginName] = pluginInstance
    this.logger.INFO(`插件 ${pluginInstance.pluginName} 安装成功`)
  }

  async uninstallPlugin(pluginName: string) {
    const plugin = this.plugins[pluginName]
    if (!plugin) {
      this.logger.WARN(`插件 ${pluginName} 未找到，无法卸载`)
      return
    }

    const unloaders = this.bot.unloaders[pluginName] ?? []
    for (const unload of unloaders) {
      unload()
    }
    this.bot.unloaders[pluginName] = []

    await plugin.uninstall()
    delete this.plugins[pluginName]
    this.logger.INFO(`插件 ${pluginName} 卸载成功`)
  }

  async loadConfig<T extends object>(pluginName: string, defaultConfig?: T, refresh = false): Promise<T> {
    if (!defaultConfig) {
      return {} as T
    }

    pluginName = normalizePluginName(pluginName)

    if (!refresh) {
      return this.configs[pluginName] ?? await this.loadConfig(pluginName, defaultConfig, true)
    }

    await fs.ensureDir(this.config.configDir)

    const configPath = path.join(this.config.configDir, `${pluginName}.json`)

    if (!await fs.exists(configPath)) {
      await fs.writeJSON(configPath, defaultConfig, { spaces: 2 })
      return defaultConfig
    }

    try {
      const currentJson = await fs.readJSON(configPath, 'utf-8')
      const config = { ...defaultConfig, ...currentJson }
      this.configs[pluginName] = config
      return config
    }
    catch (error) {
      this.logger.ERROR(`插件 ${pluginName} 配置加载失败:`, error)
      return {} as T
    }
  }

  async saveConfig<T extends object>(pluginName: string, config: T) {
    pluginName = normalizePluginName(pluginName)

    await fs.ensureDir(this.config.configDir)

    const configPath = path.join(this.config.configDir, `${pluginName}.json`)
    await fs.writeJSON(configPath, config, { spaces: 2 })

    // 保留引用
    Object.assign(this.configs[pluginName], config)
  }
}
