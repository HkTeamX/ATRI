import type { LogLevelType } from '@huan_kong/logger'
import type { BotConfig } from './bot.js'
import type { Plugin } from './plugin.js'
import path from 'node:path'
import { defaultTransformer, Logger, saveFileTransformer } from '@huan_kong/logger'
import fs from 'fs-extra'
import PackageJson from '../package.json' with { type: 'json' }
import { Bot } from './bot.js'
import { normalizePluginName } from './utils.js'

export interface ATRIConfig {
  logLevel?: LogLevelType

  configDir: string
  logDir: string
  dataDir: string
  modulesDir: string
  botConfig: BotConfig

  saveLogs: boolean
  maxFiles?: number

  disableATRIFlag?: boolean
}

export class ATRI {
  version = PackageJson.version
  config: ATRIConfig
  logger: Logger
  bot: Bot

  plugins: Record<string, Plugin<any, any>> = {}
  configs: Record<string, any> = {}

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
  }

  async init() {
    await this.bot.init()
    this.logger.INFO(`ATRI 初始化完成`)
  }

  async installPlugin(packageName: string) {
    const fullPath = import.meta.resolve(packageName, `file://${this.config.modulesDir}/`)
    const pluginModule = await import(fullPath) as { plugin: Plugin<any, any> }
    if (!('plugin' in pluginModule)) {
      this.logger.ERROR(`插件 ${packageName} 未导出 plugin`)
      return
    }

    return this.installPluginByInstance(pluginModule.plugin)
  }

  async installPluginByInstance<TContext extends object, TConfig extends object>(plugin: Plugin<TContext, TConfig>) {
    const name = plugin.getPluginName()
    if (this.plugins[name]) {
      this.logger.WARN(`插件 ${name} 已经安装，跳过安装`)
      return this.plugins[name] as Plugin<TContext, TConfig>
    }

    try {
      await plugin.build()
    }
    catch (error) {
      this.logger.ERROR(`插件 ${name} 构建失败:`, error)
      return
    }

    try {
      await plugin.emitInstall(this)
      this.logger.INFO(`插件 ${name} 安装完成`)
    }
    catch (error) {
      this.logger.ERROR(`插件 ${name} 安装失败:`, error)
      return
    }

    this.plugins[name] = plugin

    return plugin
  }

  async uninstallPlugin(pluginName: string) {
    const plugin = this.plugins[pluginName]
    if (!plugin) {
      this.logger.WARN(`插件 ${pluginName} 未安装，无法卸载`)
      return
    }

    await this.plugins[pluginName].emitUninstall()
    delete this.plugins[pluginName]
    delete this.configs[pluginName]
    this.logger.INFO(`插件 ${pluginName} 已卸载`)
  }

  async loadConfig<T extends object>(pluginName: string, defaultConfig?: T, refresh = false): Promise<T> {
    if (!defaultConfig
      || (typeof defaultConfig === 'object' && Object.keys(defaultConfig).length === 0)) {
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

    if (!this.configs[pluginName]) {
      this.configs[pluginName] = config
      return
    }

    // 保留引用
    Object.assign(this.configs[pluginName], config)
  }
}
