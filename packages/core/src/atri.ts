import type { LogLevelType } from '@huan_kong/logger'
import type { BotConfig } from './bot.js'
import type { definePluginReturnType, Plugin } from './plugin.js'
import path from 'node:path'
import { Logger } from '@huan_kong/logger'
import fs from 'fs-extra'
import { Bot } from './bot.js'

export interface ATRIConfig {
  logLevel?: LogLevelType
  botConfig: BotConfig
  configDir: string
  plugins?: definePluginReturnType<any>[]
}

export class ATRI {
  config: ATRIConfig
  logger: Logger
  bot: Bot
  plugins: { [key: string]: Plugin<any> } = {}
  configs: { [key: string]: any } = {}

  private normalizeConfigKey(pluginName: string) {
    return pluginName.replaceAll('/', '__')
  }

  constructor(config: ATRIConfig) {
    this.config = config
    this.logger = new Logger({
      title: 'ATRI',
      level: config.logLevel,
    })
    this.bot = new Bot({
      logLevel: config.logLevel,
      ...config.botConfig,
    })
  }

  async init() {
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

    await this.bot.init()

    for (const plugin of this.config.plugins ?? []) {
      await this.loadPlugin(plugin)
    }

    this.logger.INFO(`ATRI 初始化完成`)
  }

  async loadPlugin<T extends object>(plugin: definePluginReturnType<T>) {
    const pluginInstance = await plugin(this)
    if (pluginInstance.pluginName in this.plugins) {
      this.logger.WARN(`插件 ${pluginInstance.pluginName} 已经加载，跳过本次加载`)
      return
    }

    await pluginInstance.install()
    this.plugins[pluginInstance.pluginName] = pluginInstance
    this.logger.INFO(`插件 ${pluginInstance.pluginName} 加载成功`)
  }

  async unloadPlugin(pluginName: string) {
    const plugin = this.plugins[pluginName]
    if (!plugin) {
      this.logger.WARN(`插件 ${pluginName} 未找到，无法卸载`)
      return
    }

    const unloaders = this.bot.unloaders[pluginName] ?? []
    for (const unload of unloaders) {
      unload()
    }

    await plugin.uninstall()
    delete this.plugins[pluginName]
    this.logger.INFO(`插件 ${pluginName} 卸载成功`)
  }

  async loadConfig<T extends object>(pluginName: string, defaultConfig?: T, refresh = false): Promise<T> {
    if (!defaultConfig) {
      return {} as T
    }

    pluginName = this.normalizeConfigKey(pluginName)

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
    pluginName = this.normalizeConfigKey(pluginName)

    await fs.ensureDir(this.config.configDir)

    const configPath = path.join(this.config.configDir, `${pluginName}.json`)
    await fs.writeJSON(configPath, config, { spaces: 2 })

    // 保留引用
    Object.assign(this.configs[pluginName], config)
  }
}
