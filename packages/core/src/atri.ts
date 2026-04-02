import type { LogLevelType } from '@huan_kong/logger'
import type { BotConfig } from './bot.js'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { defaultTransformer, Logger, LogLevel, saveFileTransformer } from '@huan_kong/logger'
import fs from 'fs-extra'
import PackageJson from '../package.json' with { type: 'json' }
import { Bot } from './bot.js'
import { ATRICommand } from './plugin/events/command.js'
import { ATRIMessage } from './plugin/events/message.js'
import { ATRINotice } from './plugin/events/notice.js'
import { ATRIRequest } from './plugin/events/request.js'
import { Plugin } from './plugin/index.js'
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

export type PluginModule = { [key: string]: Plugin<any> | ATRICommand<any, any> | ATRIMessage<any> | ATRINotice<any> | ATRIRequest<any> }[]

export type ConfigItem<T extends object> = {
  [K in keyof T]: {
    key: K
    val: T[K]
    comment?: string
    place?: 'top' | 'bottom'
  }
}[keyof T]

export class ATRI {
  version = PackageJson.version
  config: ATRIConfig
  logger: Logger
  bot: Bot

  plugins: Record<string, Plugin<any>> = {}
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
    if (!path.isAbsolute(config.modulesDir)) {
      this.config.modulesDir = path.join(process.cwd(), config.modulesDir)
    }

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

  async installPlugin(packageName: string): Promise<boolean> {
    const importPaths = [
      path.join(this.config.modulesDir, packageName),
      path.join(this.config.modulesDir, packageName, 'src/index.js'),
    ]

    if ((this.config.logLevel ?? LogLevel.INFO) <= LogLevel.DEBUG) {
      importPaths.reverse()
    }

    let pluginModule: PluginModule
    try {
      pluginModule = await import(pathToFileURL(importPaths[0]).href)
    }
    catch {
      try {
        pluginModule = await import(pathToFileURL(importPaths[1]).href)
      }
      catch (error) {
        this.logger.ERROR(`插件 ${packageName} 加载失败:`, String(error))
        return false
      }
    }

    return this.installPluginByInstance(pluginModule)
  }

  async installPluginByInstance(pluginModule: PluginModule): Promise<boolean> {
    let success = false

    for (const moduleName in pluginModule) {
      const variable = pluginModule[moduleName]

      try {
        if (variable instanceof Plugin) {
          const name = variable.pluginName
          this.plugins[name] = variable
          success = true
          this.logger.INFO(`插件 ${name} 安装成功`)
          continue
        }

        if (variable instanceof ATRICommand) {
          const event = variable.build()
          this.bot.regCommandEvent(event)
          success = true
          this.logger.INFO(`命令 ${event.trigger} 注册成功`)
          continue
        }

        if (variable instanceof ATRIMessage) {
          const event = variable.build()
          this.bot.regMessageEvent(event)
          success = true
          this.logger.INFO(`消息事件注册成功`)
          continue
        }

        if (variable instanceof ATRINotice) {
          const event = variable.build()
          this.bot.regNoticeEvent(event)
          success = true
          this.logger.INFO(`通知事件注册成功`)
          continue
        }

        if (variable instanceof ATRIRequest) {
          const event = variable.build()
          this.bot.regRequestEvent(event)
          success = true
          this.logger.INFO(`请求事件注册成功`)
          continue
        }
      }
      catch (error) {
        this.logger.ERROR(`处理模块 ${moduleName} 时发生错误:`, error)
        continue
      }
    }

    return success
  }

  async uninstallPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins[pluginName]
    if (!plugin) {
      this.logger.WARN(`插件 ${pluginName} 未安装，无法卸载`)
      return false
    }

    const unloaders = this.bot.unloaders[pluginName]
    if (unloaders) {
      for (const unload of unloaders) {
        try {
          unload()
        }
        catch (error) {
          this.logger.ERROR(`执行插件 ${pluginName} 的取消函数时发生错误:`, error)
        }
      }
      delete this.bot.unloaders[pluginName]
    }

    delete this.plugins[pluginName]
    delete this.configs[pluginName]

    this.logger.INFO(`插件 ${pluginName} 已卸载`)
    return true
  }

  // async loadConfig<T extends object>(pluginName: string, defaultConfig?: T, refresh = false): Promise<T> {
  //   if (!defaultConfig
  //     || (typeof defaultConfig === 'object' && Object.keys(defaultConfig).length === 0)) {
  //     return {} as T
  //   }

  //   pluginName = normalizePluginName(pluginName)

  //   if (!refresh) {
  //     return this.configs[pluginName] ?? await this.loadConfig(pluginName, defaultConfig, true)
  //   }

  //   await fs.ensureDir(this.config.configDir)

  //   const configPath = path.join(this.config.configDir, `${pluginName}.json`)

  //   if (!await fs.exists(configPath)) {
  //     await fs.writeJSON(configPath, defaultConfig, { spaces: 2 })
  //     return defaultConfig
  //   }

  //   try {
  //     const currentJson = await fs.readJSON(configPath, 'utf-8')
  //     const config = { ...defaultConfig, ...currentJson }
  //     this.configs[pluginName] = config
  //     return this.configs[pluginName]
  //   }
  //   catch (error) {
  //     this.logger.ERROR(`插件 ${pluginName} 配置加载失败:`, error)
  //     return {} as T
  //   }
  // }

  // async saveConfig<T extends object>(pluginName: string, config: T) {
  //   pluginName = normalizePluginName(pluginName)

  //   await fs.ensureDir(this.config.configDir)

  //   const configPath = path.join(this.config.configDir, `${pluginName}.json`)
  //   await fs.writeJSON(configPath, config, { spaces: 2 })

  //   if (!this.configs[pluginName]) {
  //     this.configs[pluginName] = config
  //     return
  //   }

  //   // 保留引用
  //   Object.assign(this.configs[pluginName], config)
  // }
}
