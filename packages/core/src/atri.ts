import { InjectLogger, Logger, LogLevel } from '@huan_kong/logger'
import { createRequire } from 'module'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Bot } from './bot.js'
import type { ATRIConfig, LoadPluginHook, PluginModule } from './types/atri.js'
import type { BasePlugin } from './types/plugin.js'

export class ATRI extends InjectLogger {
  config: ATRIConfig
  configDir: string
  bot: Bot
  import: NodeJS.Require

  loadedPlugins: Record<string, BasePlugin> = {}
  loadPluginHooks: Record<string, LoadPluginHook> = {}

  private constructor(config: ATRIConfig, bot: Bot) {
    super({ level: config.debug ? LogLevel.DEBUG : config.logLevel })
    this.config = config
    this.bot = bot
    this.configDir = config.configDir ?? path.join(config.baseDir, 'config')
    this.import = createRequire(config.baseDir)
  }

  static async init(config: ATRIConfig) {
    if (config.debug) config.logLevel = LogLevel.DEBUG

    const logger = new Logger({
      title: 'ATRI',
      level: config.debug ? LogLevel.DEBUG : config.logLevel,
    })

    // 清空终端
    if (!config.disableClearTerminal) console.log('\x1Bc')

    if (!config.disableStartupMessage) {
      console.log(
        `%c            __               .__ 
_____     _/  |_   _______   |__|
\\__  \\    \\   __\\  \\_  __ \\  |  |
 / __ \\_   |  |     |  | \\/  |  |
(____  /   |__|     |__|     |__|
     \\/`,
        `font-family: Consolas;`,
      )
      logger.INFO(`アトリは、高性能ですから！`)
    }

    if (!('debug' in config.bot)) config.bot.debug = config.debug
    if (!('logLevel' in config.bot)) config.bot.logLevel = config.logLevel
    const bot = await Bot.init(config.bot)

    const atri = new ATRI(config, bot)
    if (config.plugins) {
      const res = await atri.loadPlugins(config.plugins)
      if (!res) {
        logger.ERROR('插件加载失败，程序终止')
        process.exit(1)
      }
    }

    logger.INFO(`ATRI 初始化完成`)

    return atri
  }

  async loadPlugin(pluginName: string) {
    this.logger.INFO(`加载插件: ${pluginName}`)

    let module: PluginModule
    try {
      module = await this.import(pluginName)
    } catch (error) {
      this.logger.ERROR(`插件 ${pluginName} 加载失败:`, error)
      return false
    }

    if (!module.Plugin) {
      this.logger.ERROR(`插件 ${pluginName} 加载失败: 未找到 Plugin 类`)
      return false
    }

    try {
      const plugin = new module.Plugin(this)

      if (!plugin.pluginName) {
        this.logger.ERROR(`插件 ${pluginName} 加载失败: 缺少必要参数: pluginName`)
        return false
      }

      // 触发加载钩子
      for (const hookName in this.loadPluginHooks) {
        const hook = this.loadPluginHooks[hookName]
        const result = await hook(plugin)
        if (!result) {
          this.logger.ERROR(`插件 ${plugin.pluginName} 加载失败: 加载钩子 ${hookName} 返回 false`)
          return false
        }
      }

      // 自动加载配置
      if (!plugin.getDisableAutoLoadConfig()) {
        const config = await this.loadConfig(plugin.getConfigName(), plugin.getDefaultConfig())
        plugin.setConfig(config)
      }

      await plugin.load()

      this.loadedPlugins[plugin.pluginName] = plugin
      this.logger.INFO(`插件 ${plugin.pluginName} 加载成功`)
    } catch (error) {
      this.logger.ERROR(`插件 ${pluginName} 加载失败:`, error)
      return false
    }

    return true
  }

  async loadPlugins(pluginNames: string[]) {
    for (const pluginName of pluginNames) {
      const res = await this.loadPlugin(pluginName)
      if (!res) return false
    }
    return true
  }

  async unloadPlugin(pluginName: string) {
    if (!this.loadedPlugins[pluginName]) {
      this.logger.WARN(`插件 ${pluginName} 未加载`)
      return true
    }

    const plugin = this.loadedPlugins[pluginName]
    try {
      plugin.getUnregHandlers().forEach((unreg) => unreg())
      await plugin.unload()
      delete this.loadedPlugins[pluginName]
      this.logger.INFO(`插件 ${pluginName} 卸载成功`)
    } catch (error) {
      this.logger.ERROR(`插件 ${pluginName} 卸载失败:`, error)
      return false
    }

    return true
  }

  async loadConfig<TConfig extends object>(pluginName: string, defaultConfig: TConfig) {
    if (!fs.existsSync(this.configDir)) fs.mkdirSync(this.configDir, { recursive: true })
    const configPath = path.join(this.configDir, `${pluginName}.json`)

    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
      return defaultConfig
    }

    try {
      const currentJson = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as TConfig
      return { ...defaultConfig, ...currentJson }
    } catch (error) {
      this.logger.ERROR(`插件 ${pluginName} 配置加载失败:`, error)
      return {}
    }
  }

  async saveConfig<TConfig extends object>(pluginName: string, config: TConfig) {
    if (!fs.existsSync(this.configDir)) fs.mkdirSync(this.configDir, { recursive: true })
    const configPath = path.join(this.configDir, `${pluginName}.json`)
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  }

  addPluginLoadHook(hookName: string, hook: LoadPluginHook) {
    this.loadPluginHooks[hookName] = hook
  }

  removePluginLoadHook(hookName: string) {
    delete this.loadPluginHooks[hookName]
  }
}
