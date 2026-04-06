import type { Logger, LogLevelType } from '@huan_kong/logger'
import type { BotConfig } from '@/bot.js'
import type { ATRICommand } from '@/plugin/events/command.js'
import type { ATRIMessage } from '@/plugin/events/message.js'
import type { ATRINotice } from '@/plugin/events/notice.js'
import type { ATRIRequest } from '@/plugin/events/request.js'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createLogger, defaultTransformer, LogLevel, saveFileTransformer } from '@huan_kong/logger'
import PackageJson from '@root/package.json' with { type: 'json' }
import fs from 'fs-extra'
import { Document, parseDocument } from 'yaml'
import { Bot } from '@/bot.js'
import { commandSymbol } from '@/plugin/events/command.js'
import { messageSymbol } from '@/plugin/events/message.js'
import { noticeSymbol } from '@/plugin/events/notice.js'
import { requestSymbol } from '@/plugin/events/request.js'
import { Plugin, pluginSymbol } from '@/plugin/index.js'
import { decodeUnicode, normalizePluginName } from '@/utils.js'

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

  name?: string
  version?: string
}

export type ConfigItem<T extends object> = {
  [K in keyof T]: {
    key: K
    val: T[K]
    comment?: string
    place?: 'top' | 'bottom'
  }
}[keyof T]

export interface PluginModule { [key: string]: Plugin<any> | ATRICommand<any, any, any> | ATRIMessage<any, any> | ATRINotice<any, any> | ATRIRequest<any, any> }

export class ATRI {
  name: string
  version: string

  atriVersion = PackageJson.version
  config: Required<ATRIConfig>
  logger: Logger
  bot: Bot

  plugins: Record<string, Plugin<any>> = {}
  configs: Record<string, any> = {}
  loggers: Record<string, Logger> = {}

  private async removeUselessLogs() {
    const files = await Array.fromAsync(fs.promises.glob(`${this.config.logDir}/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*.log`))
    const maxFiles = this.config.maxFiles

    if (files.length <= maxFiles)
      return

    const filesToDeleteCount = files.length - maxFiles + 1

    files
      .sort()
      .slice(0, filesToDeleteCount)
      .map(file => fs.promises.rm(path.join(this.config.logDir, file)).catch())
  }

  constructor(config: ATRIConfig) {
    this.config = {
      name: 'ATRI',
      version: '1.0.0',
      disableATRIFlag: false,
      maxFiles: 30,
      logLevel: LogLevel.INFO,
      ...config,
    }
    this.name = config.name ?? 'ATRI'
    this.version = config.version ?? '1.0.0'
    this.logger = createLogger('ATRI', {
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

    return this.installPluginByInstance(pluginModule, packageName)
  }

  private createPluginContextHelpers(pluginName: string) {
    const plugin = this.plugins[pluginName]
    if (!plugin) {
      throw new Error(`插件 ${pluginName} 未安装，无法获取配置上下文`)
    }

    return {
      atri: this,
      bot: this.bot,
      ws: this.bot.ws,
      config: this.configs[normalizePluginName(pluginName)] ?? {},
      logger: this.loggers[pluginName],
      refreshConfig: async () => await this.loadConfig(pluginName, plugin.defaultConfig, true),
      saveConfig: async (config?: any) => await this.saveConfig(pluginName, config ?? this.configs[normalizePluginName(pluginName)] ?? {}),
    }
  }

  async installPluginByInstance(pluginModule: PluginModule, packageName = '未知模块'): Promise<boolean> {
    let success = false

    // 查找所有plugin实例
    const pluginInstances = Object.entries(pluginModule).filter(([_, variable]) => variable instanceof Plugin || variable?.symbol === pluginSymbol) as [string, Plugin<any>][]
    if (pluginInstances.length > 1) {
      this.logger.ERROR(`检测到插件模块 ${packageName} 中存在多个 Plugin 实例，可能会导致配置文件覆盖等问题，请确保每个插件模块中只有一个 Plugin 实例。`)
      return false
    }

    if (pluginInstances.length === 0) {
      this.logger.ERROR(`插件模块 ${packageName} 中未找到 Plugin 实例，请确保插件模块正确导出一个 Plugin 实例。`)
      return false
    }

    let pluginName = '未知插件名'

    try {
      const pluginInstance = pluginInstances[0][1]
      pluginName = pluginInstance.pluginName

      this.loggers[pluginName] = this.logger.clone({ title: pluginName })
      await this.loadConfig(pluginName, pluginInstance.defaultConfig)
      this.plugins[pluginName] = pluginInstance
      this.logger.INFO(`插件 ${pluginName} 安装成功`)

      // 执行安装函数
      if (pluginInstance.installHandler) {
        await pluginInstance.installHandler(this.createPluginContextHelpers(pluginName))
        this.logger.INFO(`插件 ${pluginName} 安装函数执行完成`)
      }
      success = true
    }
    catch (error) {
      this.logger.ERROR(`插件 ${pluginName} 安装失败:`, error)
      delete this.plugins[pluginName]
      delete this.loggers[pluginName]
      delete this.configs[normalizePluginName(pluginName)]

      return false
    }

    for (const moduleName in pluginModule) {
      const variable = pluginModule[moduleName]

      try {
        if (!('symbol' in variable) || variable.symbol === pluginSymbol) {
          continue
        }

        if (variable.symbol === commandSymbol) {
          const commandVariable = variable as ATRICommand<any, any, any>
          const event = commandVariable.build()
          this.bot.regCommandEvent(event)
          success = true
          this.logger.DEBUG(`插件 ${pluginName} 命令 ${decodeUnicode(event.trigger.toString())} 注册成功`)
          continue
        }
        else if (variable.symbol === messageSymbol) {
          const messageVariable = variable as ATRIMessage<any, any>
          const event = messageVariable.build()
          this.bot.regMessageEvent(event)
          success = true
          this.logger.DEBUG(`插件 ${pluginName} 消息 ${decodeUnicode(event.trigger?.toString() ?? '无触发器')} 注册成功`)
          continue
        }
        else if (variable.symbol === noticeSymbol) {
          const noticeVariable = variable as ATRINotice<any, any>
          const event = noticeVariable.build()
          this.bot.regNoticeEvent(event)
          success = true
          this.logger.DEBUG(`插件 ${pluginName} 通知事件注册成功`)
          continue
        }
        else if (variable.symbol === requestSymbol) {
          const requestVariable = variable as ATRIRequest<any, any>
          const event = requestVariable.build()
          this.bot.regRequestEvent(event)
          success = true
          this.logger.DEBUG(`插件 ${pluginName} 请求事件注册成功`)
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
      this.logger.ERROR(`插件 ${pluginName} 未安装，无法卸载`)
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

    // 执行卸载函数
    if (plugin.uninstallHandler) {
      try {
        await plugin.uninstallHandler(this.createPluginContextHelpers(pluginName))
        this.logger.INFO(`插件 ${pluginName} 卸载函数执行完成`)
      }
      catch (error) {
        this.logger.ERROR(`执行插件 ${pluginName} 的卸载函数时发生错误:`, error)
      }
    }

    delete this.plugins[pluginName]
    delete this.loggers[pluginName]
    delete this.configs[normalizePluginName(pluginName)]

    this.logger.INFO(`插件 ${pluginName} 已卸载`)
    return true
  }

  async loadConfig<TConfig extends object>(pluginName: string, defaultConfig?: ConfigItem<TConfig>[], refresh = false): Promise<TConfig> {
    pluginName = normalizePluginName(pluginName)

    if (!refresh) {
      return this.configs[pluginName] ?? await this.loadConfig(pluginName, defaultConfig, true)
    }

    const config = await this.syncConfig(pluginName, defaultConfig ?? []) as TConfig
    this.configs[pluginName] = config
    return this.configs[pluginName]
  }

  private async syncConfig<TConfig extends object>(pluginName: string, config: ConfigItem<TConfig>[]): Promise<TConfig> {
    if (config.length === 0) {
      return {} as TConfig
    }

    pluginName = normalizePluginName(pluginName)

    await fs.ensureDir(this.config.configDir)
    const configPath = path.join(this.config.configDir, `${pluginName}.yaml`)

    let doc: Document
    if (!await fs.promises.exists(configPath)) {
      doc = new Document()
    }
    else {
      const content = await fs.promises.readFile(configPath, 'utf-8')
      doc = parseDocument(content)
    }

    config.forEach((item) => {
      // 如果配置文件中已经存在该配置项，则不覆盖
      if (doc.has(item.key)) {
        return
      }

      const node = doc.createNode(item.val)

      if (item.comment) {
        if (item.place === 'bottom') {
          node.comment = ` ${item.comment}`
        }
        else {
          node.commentBefore = ` ${item.comment}`
        }
      }

      doc.set(item.key, node)
    })

    await fs.promises.writeFile(configPath, doc.toString())
    return doc.toJS() as TConfig
  }

  async saveConfig<TConfig extends object>(pluginName: string, config: TConfig) {
    pluginName = normalizePluginName(pluginName)

    await fs.ensureDir(this.config.configDir)
    const configPath = path.join(this.config.configDir, `${pluginName}.yaml`)

    let doc: Document
    if (!await fs.promises.exists(configPath)) {
      doc = new Document()
    }
    else {
      const content = await fs.promises.readFile(configPath, 'utf-8')
      doc = parseDocument(content)
    }

    Object.entries(config).forEach(([key, val]) => {
      doc.set(key, val)

      if (Object.hasOwn(this.configs, pluginName)) {
        this.configs[pluginName][key] = val
      }
    })

    await fs.promises.writeFile(configPath, doc.toString())
  }
}
