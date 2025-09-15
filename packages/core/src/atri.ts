import { InjectLogger, Logger, LogLevel } from '@huan_kong/logger'
import { createRequire } from 'module'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Bot } from './bot.js'
import type { ATRIConfig, LoadPluginHook, LoadPluginOptions, PluginModule } from './types/atri.js'
import type { BasePlugin, PackageJson } from './types/plugin.js'

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

    for (const packageName of config.plugins ?? []) {
      const [retCode] = await atri.loadPlugin(packageName)
      if (retCode !== 0) {
        logger.ERROR('插件加载失败，程序终止')
        process.exit(1)
      }
    }

    logger.INFO(`ATRI 初始化完成`)

    return atri
  }

  /**
   * 0 - 成功 (返回 插件实例化后的对象)
   * 1 - 失败 (返回 错误信息)
   * 2 - 加载钩子返回 false (返回 钩子名)
   */
  async loadPlugin(
    packageName: string,
    options?: LoadPluginOptions,
  ): Promise<[0, BasePlugin] | [1 | 2, string]> {
    options = {
      initPlugin: true,
      quiet: false,
      ...(options ?? {}),
    }
    if (!options.quiet) this.logger.INFO(`加载插件: ${packageName}`)

    if (this.loadedPlugins[packageName]) {
      if (!options.quiet) this.logger.WARN(`插件 ${packageName} 已加载，跳过加载`)
      return [0, this.loadedPlugins[packageName]]
    }

    // 如果正在开发模式，则优先从源代码加载
    let importPath = [packageName, path.join(packageName, 'src/index.ts')]
    if (this.config.debug) importPath = importPath.reverse()

    let module: PluginModule
    try {
      module = await this.import(importPath[0])
    } catch {
      try {
        module = await this.import(importPath[1])
      } catch (error) {
        if (!options.quiet) this.logger.ERROR(`插件 ${packageName} 导入失败:`, error)
        return [1, error instanceof Error ? error.message : String(error)]
      }
    }

    if (!module.Plugin) {
      if (!options.quiet) this.logger.ERROR(`插件 ${packageName} 加载失败: 未找到 Plugin 类`)
      return [1, '未找到 Plugin 类']
    }

    let packageJson: PackageJson
    try {
      const pkgPath = this.import.resolve(path.join(packageName, 'package.json'))
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      packageJson = pkg
    } catch (error) {
      if (!options.quiet) {
        this.logger.WARN(`插件 ${packageName} 未找到 package.json, 将使用未知代替`)
        this.logger.DEBUG(error)
      }
      packageJson = { name: '未知', version: '未知' }
    }

    let plugin: BasePlugin
    try {
      plugin = new module.Plugin(this, packageJson)
    } catch (error) {
      if (!options.quiet) this.logger.ERROR(`插件 ${packageName} 实例化失败:`, error)
      return [1, error instanceof Error ? error.message : String(error)]
    }

    if (!options.initPlugin) return [0, plugin]

    try {
      // 触发加载钩子
      for (const hookName in this.loadPluginHooks) {
        const hook = this.loadPluginHooks[hookName]
        const result = await hook({
          plugin,
          packageName,
        })
        if (!result) {
          if (!options.quiet) {
            this.logger.ERROR(`插件 ${packageName} 加载失败: 加载钩子 ${hookName} 返回 false`)
          }
          return [2, hookName]
        }
      }

      // 自动加载配置
      if (!plugin.disableAutoLoadConfig) {
        plugin.config = await this.loadConfig(
          plugin.configName ?? packageName,
          plugin.defaultConfig ?? {},
        )
      }

      await plugin.load()

      this.loadedPlugins[packageName] = plugin
      if (!options.quiet) this.logger.INFO(`插件 ${packageName} 加载成功`)

      return [0, plugin]
    } catch (error) {
      if (!options.quiet) this.logger.ERROR(`插件 ${packageName} 加载失败:`, error)
      return [1, error instanceof Error ? error.message : String(error)]
    }
  }

  async unloadPlugin(packageName: string): Promise<[0] | [1, string]> {
    const plugin = this.loadedPlugins[packageName]

    if (!plugin) {
      this.logger.WARN(`插件 ${packageName} 未加载`)
      return [1, '插件未加载']
    }

    try {
      plugin.unregHandlers.forEach((unreg) => unreg())
      await plugin.unload()

      delete this.loadedPlugins[packageName]

      this.logger.INFO(`插件 ${packageName} 卸载成功`)
      return [0]
    } catch (error) {
      this.logger.ERROR(`插件 ${packageName} 卸载失败:`, error)
      return [1, error instanceof Error ? error.message : String(error)]
    }
  }

  async loadConfig<TConfig extends object>(packageName: string, defaultConfig: TConfig) {
    packageName = packageName.replaceAll('/', '__')

    if (!fs.existsSync(this.configDir)) fs.mkdirSync(this.configDir, { recursive: true })
    const configPath = path.join(this.configDir, `${packageName}.json`)

    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
      return defaultConfig
    }

    try {
      const currentJson = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as TConfig
      return { ...defaultConfig, ...currentJson }
    } catch (error) {
      this.logger.ERROR(`插件 ${packageName} 配置加载失败:`, error)
      return {}
    }
  }

  async saveConfig<TConfig extends object>(packageName: string, config: TConfig) {
    packageName = packageName.replaceAll('/', '__')

    if (!fs.existsSync(this.configDir)) fs.mkdirSync(this.configDir, { recursive: true })
    const configPath = path.join(this.configDir, `${packageName}.json`)
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  }

  addPluginLoadHook(hookName: string, hook: LoadPluginHook) {
    this.loadPluginHooks[hookName] = hook
  }

  removePluginLoadHook(hookName: string) {
    delete this.loadPluginHooks[hookName]
  }
}
