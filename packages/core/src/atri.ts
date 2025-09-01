import { satisfies } from 'compare-versions'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { Bot, type BotConfig } from './bot.js'
import { Logger } from './logger.js'
import type { BasePlugin } from './plugin.js'

export type ATRIConfig = {
  bot: BotConfig
  debug?: boolean
  base_dir: string
  disable_help_plugin?: boolean
  disable_clear_terminal?: boolean
  disable_startup_message?: boolean

  load_this_is_a_cake_plugin?: boolean
}

export interface WaitingPlugin {
  plugin_path: string
  dependencies: { [key: string]: string }
}

export class ATRI {
  bot: Bot
  logger: Logger
  config: ATRIConfig

  loaded_plugins: { [key: string]: BasePlugin<object> } = {}
  waiting_plugins: { [key: string]: WaitingPlugin } = {}

  constructor(config: ATRIConfig, bot: Bot) {
    this.bot = bot
    this.logger = new Logger('ATRI', config.debug)
    this.config = config

    this.logger.SUCCESS(`ATRI 初始化完成`)
  }

  static async init(config: ATRIConfig) {
    const logger = new Logger('ATRI', config.debug)

    // 清空终端
    if (!config.disable_clear_terminal) console.log('\x1Bc')

    if (!config.disable_startup_message) {
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

    logger.DEBUG(`初始化 ATRI 实例`)
    logger.DEBUG(`配置信息:`, config)

    if (!('debug' in config.bot)) config.bot.debug = config.debug
    const bot = await Bot.init(config.bot)

    const atri = new ATRI(config, bot)
    if (!config.disable_help_plugin) await atri.load_plugin('./plugins/help', import.meta.dirname)
    if (config.load_this_is_a_cake_plugin)
      await atri.load_plugin('./plugins/this_is_a_cake', import.meta.dirname)

    return atri
  }

  /**
   * 0 - 加载成功
   * 1 - 缺少依赖
   * 2 - 其他错误
   */
  async load_plugin(plugin_path: string, base_dir = this.config.base_dir): Promise<0 | 1 | 2> {
    this.logger.DEBUG(`开始加载 ${plugin_path} 插件`)

    const base_plugin_dir = path.join(base_dir, plugin_path)
    let plugin_dir = base_plugin_dir
    this.logger.DEBUG(`插件导入路径: ${plugin_dir}`)

    if (!fs.existsSync(plugin_dir)) {
      plugin_dir = `${base_plugin_dir}.ts`

      this.logger.DEBUG(`插件非文件夹插件, 尝试为单文件TS插件`)
      this.logger.DEBUG(`新插件导入路径: ${plugin_dir}`)
    }

    if (!fs.existsSync(plugin_dir)) {
      plugin_dir = `${base_plugin_dir}.js`

      this.logger.DEBUG(`插件非文件夹插件, 尝试为单文件JS插件`)
      this.logger.DEBUG(`新插件导入路径: ${plugin_dir}`)
    }

    if (!fs.existsSync(plugin_dir)) {
      this.logger.ERROR(`插件 ${plugin_dir} 入口文件不存在`)
      return 2
    }

    let plugin_entity: BasePlugin | undefined
    try {
      const module = await import(url.pathToFileURL(plugin_dir).toString())
      const plugin_variable = module.Plugin

      if (!plugin_variable) {
        this.logger.ERROR(`插件 ${plugin_path} 加载失败, 插件未导出 Plugin 变量`)
        return 2
      }

      plugin_entity = new plugin_variable(this) as BasePlugin
      if (!plugin_entity.name || !plugin_entity.version) {
        this.logger.ERROR(`插件 ${plugin_path} 加载失败, 插件缺少必要参数`)
        return 2
      }

      if (this.loaded_plugins[plugin_entity.name]) {
        this.logger.INFO(`插件 ${plugin_entity.name} 已加载过, 跳过本次加载`)
        return 2
      }

      // 检查依赖
      if (plugin_entity.dependencies) {
        const result = this.check_dependencies(plugin_entity.name, plugin_entity.dependencies)
        if (!result) {
          this.waiting_plugins[plugin_entity.name] = {
            plugin_path,
            dependencies: plugin_entity.dependencies ?? {},
          }
          return 1
        }
      }

      // 开始加载配置文件
      if (plugin_entity.auto_load_config ?? true) {
        const config = await this.load_config(
          plugin_entity.config_name ?? plugin_entity.name,
          plugin_entity.default_config,
        )
        plugin_entity.config = config
      } else {
        plugin_entity.config = {}
      }

      // 执行初始化
      await plugin_entity.init?.()
    } catch (error) {
      this.logger.ERROR(`加载插件 ${plugin_entity?.name ?? plugin_path} 失败`, error)
      return 2
    }

    this.loaded_plugins[plugin_entity.name] = plugin_entity
    this.logger.SUCCESS(`插件 ${plugin_entity.name} 加载成功`)

    // 加载完成了, 检查等待队列
    if (Object.keys(this.waiting_plugins).length > 0) {
      for (const [plugin_name, waiting_plugin] of Object.entries(this.waiting_plugins)) {
        if (plugin_entity.name === plugin_name) continue
        // 检查依赖
        const result = this.check_dependencies(plugin_name, waiting_plugin.dependencies)
        if (result) {
          this.logger.DEBUG(`等待队列中的插件 ${plugin_name} 依赖满足, 开始加载`)
          const load_result = await this.load_plugin(waiting_plugin.plugin_path)
          // 移除等待队列
          if (load_result === 0) delete this.waiting_plugins[plugin_name]
        }
      }
    }

    return 0
  }

  private check_dependencies(
    plugin_name: string,
    dependencies: WaitingPlugin['dependencies'] = {},
  ) {
    for (const [name, version] of Object.entries(dependencies)) {
      const loaded_plugin = this.loaded_plugins[name]
      if (!loaded_plugin) {
        this.logger.DEBUG(`插件 ${plugin_name} 加载失败, 缺少依赖插件 ${name}, 已加入等待队列`)
        return false
      }

      if (!satisfies(loaded_plugin.version, version)) {
        this.logger.ERROR(
          `插件 ${plugin_name} 加载失败, 依赖插件 ${name} 版本不匹配 (需要: ${version}, 当前: ${loaded_plugin.version})`,
        )
        return false
      }
    }

    return true
  }

  async load_config(config_name: string, default_config = {}) {
    this.logger.DEBUG(`开始加载 ${config_name} 配置`)

    const config_dir = path.join(this.config.base_dir, 'config')
    if (!fs.existsSync(config_dir)) fs.mkdirSync(config_dir)

    const config_file = path.join(config_dir, `${config_name}.json`)
    if (!fs.existsSync(config_file))
      fs.writeFileSync(config_file, JSON.stringify(default_config, null, 2))

    const config_text = fs.readFileSync(config_file, 'utf-8')
    let config_json: object | undefined

    try {
      config_json = JSON.parse(config_text) as object
      config_json = { ...default_config, ...config_json }
      fs.writeFileSync(config_file, JSON.stringify(config_json, null, 2))
    } catch (error) {
      this.logger.ERROR(`配置 ${config_name} 加载失败`, error)
      throw new Error(`配置 ${config_name} 加载失败`)
    }

    this.logger.DEBUG(`配置 ${config_name} 内容:`, config_json)
    this.logger.SUCCESS(`配置 ${config_name} 加载成功`)

    return config_json
  }

  async load_plugins(plugins: string[], base_dir = this.config.base_dir) {
    for (const plugin of plugins) {
      const result = await this.load_plugin(plugin, base_dir)
      if (result === 2) return false
    }
    return true
  }

  check_waiting_plugins() {
    const plugins = Object.keys(this.waiting_plugins)
    if (plugins.length <= 0) {
      this.logger.SUCCESS(`所有插件已加载完成`)
      return false
    }
    this.logger.ERROR(`====================================================================`)
    this.logger.ERROR(`请检查, 以下插件正在等待依赖:`)
    this.logger.ERROR(plugins.join(', '))
    this.logger.ERROR(`====================================================================`)
    this.logger.DEBUG('插件信息:', this.waiting_plugins)
    process.exit(1)
  }
}
