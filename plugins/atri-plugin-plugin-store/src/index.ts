import type { CommandCallback, LoadPluginHookContext } from '@atri-bot/core'
import type { SendMessageSegment } from 'node-napcat-ts'
import fs from 'node:fs'
import path from 'node:path'
import {
  BasePlugin,

  CommanderUtils,

} from '@atri-bot/core'
import { Command } from 'commander'
import { execa } from 'execa'
import { Structs } from 'node-napcat-ts'

export interface PluginStoreConfig {
  plugins: Record<string, boolean>
  autoLoadPlugins: Record<string, boolean>
}

export interface ShowPluginListContext {
  params: { refresh?: boolean }
}

export interface PluginManagementContext {
  args: ['启用' | '禁用' | '加载' | '卸载' | '安装' | '删除', string]
}

export interface PluginAutoLoadContext {
  args: ['启用' | '禁用', string]
}

export class Plugin extends BasePlugin<PluginStoreConfig> {
  defaultConfig: PluginStoreConfig = {
    plugins: {},
    autoLoadPlugins: {},
  }

  plugins: Record<string, BasePlugin> = {}
  canNotAutoLoadPlugins = ['@atri-bot/plugin-plugin-store']

  async load() {
    this.atri.addPluginLoadHook('plugin_store', this.loadPluginHook.bind(this))
    await this.refreshPluginList()

    const autoLoadPlugins = Object.keys(this.config.autoLoadPlugins).filter(
      packageName => !this.canNotAutoLoadPlugins.includes(packageName),
    )

    for (const packageName of autoLoadPlugins) await this.atri.loadPlugin(packageName)

    this.regCommandEvent({
      commandName: '插件列表',
      commander: new Command()
        .description('显示已安装的插件列表')
        .option('-r, --refresh', '刷新插件列表'),
      needAdmin: true,
      callback: this.handleShowPluginList.bind(this),
    })

    this.regCommandEvent({
      commandName: '插件管理',
      commander: new Command()
        .description('管理已安装的插件')
        .argument(
          '<action>',
          '操作 [启用/禁用/加载/卸载/安装/删除]',
          CommanderUtils.enum(['启用', '禁用', '加载', '卸载', '安装', '删除']),
        )
        .argument('<packageName>', '包名'),
      needAdmin: true,
      callback: this.handlePluginManagement.bind(this),
    })

    this.regCommandEvent({
      commandName: '插件自启管理',
      commander: new Command()
        .description('管理已安装的插件启动自动加载')
        .argument('<action>', '操作 [启用/禁用]', CommanderUtils.enum(['启用', '禁用']))
        .argument('<packageName>', '包名'),
      needAdmin: true,
      callback: this.handlePluginAutoLoad.bind(this),
    })
  }

  unload() {}

  loadPluginHook(hookContext: LoadPluginHookContext) {
    const is_enabled = this.config.plugins[hookContext.packageName] ?? true
    if (!is_enabled)
      this.logger.INFO(`插件 ${hookContext.packageName} 被禁用, 跳过加载`)
    return is_enabled
  }

  async refreshPluginList() {
    this.plugins = {}

    let packageJson: string

    try {
      packageJson = fs.readFileSync(path.join(this.atri.config.baseDir, '../package.json'), 'utf-8')
    }
    catch (error) {
      this.logger.WARN('读取 package.json 失败:', error)
      throw new Error('读取 package.json 失败')
    }

    try {
      const packageData = JSON.parse(packageJson)
      const dependencies = Object.keys(packageData.dependencies ?? {})
      const devDependencies = Object.keys(packageData.devDependencies ?? {})
      const allDependencies = [...dependencies, ...devDependencies]

      for (const packageName of allDependencies) {
        if (packageName.includes('atri-bot-plugin') || packageName.includes('@atri-bot/plugin-')) {
          const res = await this.atri.loadPlugin(packageName, {
            quiet: true,
            initPlugin: false,
          })
          if (res[0] !== 0)
            continue
          this.plugins[packageName] = res[1]
        }
      }
    }
    catch (error) {
      this.logger.WARN('获取插件列表失败:', error)
    }

    // 检查是否存在常用基础插件安装
    const commonPlugins = ['@atri-bot/plugin-help']
    for (const packageName of commonPlugins) {
      if (
        Object.keys(this.plugins).includes(packageJson)
        && !this.config.autoLoadPlugins[packageName]
        && !(packageName in this.atri.loadedPlugins)
      ) {
        this.config.autoLoadPlugins[packageName] = true
      }
    }
    this.saveConfig()
  }

  async handleShowPluginList({ context, params }: CommandCallback<ShowPluginListContext>) {
    if (params.refresh)
      await this.refreshPluginList()

    const message: SendMessageSegment[] = [
      Structs.text(
        `当前已有插件${Object.keys(this.plugins).length}个${params.refresh ? '(已刷新)' : ''}:\n`,
      ),
      ...Object.entries(this.plugins).map(([packageName, plugin]) => {
        return Structs.text(
          [
            ` - ${packageName} (${plugin.packageJson.version})`,
            `   - 插件状态: ${!(packageName in this.config.plugins) || this.config.plugins[packageName] ? '启用' : '禁用'}`,
            `   - 加载状态: ${packageName in this.atri.loadedPlugins ? '已加载' : '未加载'}`,
            `   - 开机自启: ${packageName in this.config.autoLoadPlugins ? '启用' : '禁用'}\n`,
          ].join('\n'),
        )
      }),
    ]
    await this.bot.sendMsg(context, message)
  }

  async handlePluginManagement(eventContext: CommandCallback<PluginManagementContext>) {
    const { context, args } = eventContext
    const [action, packageName] = args

    if (action === '安装') {
      this.installPlugin(eventContext, packageName)
      return
    }

    if (!this.plugins[packageName]) {
      await this.bot.sendMsg(context, [Structs.text(`插件 ${packageName} 不存在`)])
      return
    }

    if (action === '加载') {
      this.loadPlugin(eventContext, packageName)
    }
    else if (action === '卸载') {
      this.unloadPlugin(eventContext, packageName)
    }
    else if (action === '启用') {
      this.enablePlugin(eventContext, packageName)
    }
    else if (action === '禁用') {
      this.disablePlugin(eventContext, packageName)
    }
    else if (action === '删除') {
      this.uninstallPlugin(eventContext, packageName)
    }
  }

  async enablePlugin(eventContext: CommandCallback<PluginManagementContext>, packageName: string) {
    if (packageName in this.config.plugins && this.config.plugins[packageName]) {
      await this.bot.sendMsg(eventContext.context, [
        Structs.text(`插件 ${packageName} 无法启用, 因为已经启用`),
      ])
      return
    }

    this.config.plugins[packageName] = true
    this.saveConfig()

    await this.bot.sendMsg(eventContext.context, [
      Structs.text(`插件 ${packageName} 启用成功, 自动加载中...`),
    ])

    await this.loadPlugin(eventContext, packageName)
  }

  async disablePlugin(eventContext: CommandCallback<PluginManagementContext>, packageName: string) {
    if (packageName in this.config.plugins && !this.config.plugins[packageName]) {
      await this.bot.sendMsg(eventContext.context, [
        Structs.text(`插件 ${packageName} 无法禁用, 因为已经禁用`),
      ])
      return
    }

    this.config.plugins[packageName] = false
    this.saveConfig()

    await this.bot.sendMsg(eventContext.context, [
      Structs.text(`插件 ${packageName} 禁用成功, 自动卸载中...`),
    ])

    await this.unloadPlugin(eventContext, packageName)
  }

  async loadPlugin(eventContext: CommandCallback<PluginManagementContext>, packageName: string) {
    const response = await this.atri.loadPlugin(packageName)
    if (response[0] !== 0) {
      await this.bot.sendMsg(eventContext.context, [
        Structs.text(`插件 ${packageName} 加载失败:\n`),
        Structs.text(response[0] === 2 ? `被加载钩子 ${response[1]} 禁用了` : response[1]),
      ])
      return
    }

    await this.bot.sendMsg(eventContext.context, [Structs.text(`插件 ${packageName} 加载成功`)])
  }

  async unloadPlugin(eventContext: CommandCallback<PluginManagementContext>, pluginName: string) {
    const response = await this.atri.unloadPlugin(pluginName)
    if (response[0] !== 0) {
      await this.bot.sendMsg(eventContext.context, [
        Structs.text(`插件 ${pluginName} 卸载失败:\n`),
        Structs.text(response[1]),
      ])
      return
    }

    await this.bot.sendMsg(eventContext.context, [Structs.text(`插件 ${pluginName} 卸载成功`)])
  }

  async runPnpmCommand(args: string[]): Promise<[0] | [1, string]> {
    let command = 'npx pnpm'
    try {
      await execa('pnpm', ['--version'])
      command = 'pnpm'
    }
    catch (error) {
      this.logger.DEBUG('未检测到全局 pnpm, 使用 npx 运行 pnpm:', error)
      command = 'npx pnpm'
    }
    try {
      const response = await execa(command, args, {
        cwd: path.join(this.atri.config.baseDir, '..'),
      })
      this.logger.DEBUG('安装插件成功, pnpm 输出:', response.stdout)
      return [0]
    }
    catch (error) {
      return [1, (error as Error).message]
    }
  }

  async installPlugin(eventContext: CommandCallback<PluginManagementContext>, packageName: string) {
    await this.bot.sendMsg(eventContext.context, [Structs.text('正在安装插件, 请稍候...')])

    const [retCode, message] = await this.runPnpmCommand(['add', packageName])
    if (retCode === 1) {
      await this.bot.sendMsg(eventContext.context, [Structs.text(`安装插件失败:${message}`)])
      return
    }

    await this.handlePluginAutoLoad({
      ...eventContext,
      args: ['启用', packageName],
    })

    await this.bot.sendMsg(eventContext.context, [Structs.text('插件安装成功, 自动加载中...')])

    await this.loadPlugin(eventContext, packageName)

    await this.refreshPluginList()
  }

  async uninstallPlugin(
    eventContext: CommandCallback<PluginManagementContext>,
    packageName: string,
  ) {
    await this.bot.sendMsg(eventContext.context, [Structs.text('正在删除插件, 自动卸载中...')])

    await this.unloadPlugin(eventContext, packageName)

    const [retCode, message] = await this.runPnpmCommand(['remove', packageName])
    if (retCode === 1) {
      await this.bot.sendMsg(eventContext.context, [Structs.text(`删除插件失败:${message}`)])
      return
    }

    delete this.config.plugins[packageName]
    await this.handlePluginAutoLoad({
      ...eventContext,
      args: ['禁用', packageName],
    })

    await this.bot.sendMsg(eventContext.context, [Structs.text('插件删除成功')])

    await this.refreshPluginList()
  }

  async handlePluginAutoLoad({ context, args }: CommandCallback<PluginAutoLoadContext>) {
    const [action, packageName] = args

    if (this.canNotAutoLoadPlugins.includes(packageName)) {
      await this.bot.sendMsg(context, [Structs.text(`插件 ${packageName} 不支持设置自启`)])
      return
    }

    if (action === '启用') {
      this.config.autoLoadPlugins[packageName] = true
      await this.bot.sendMsg(context, [Structs.text(`启用插件 ${packageName} 自启成功`)])
    }
    else if (action === '禁用') {
      delete this.config.autoLoadPlugins[packageName]
      await this.bot.sendMsg(context, [Structs.text(`禁用插件 ${packageName} 自启成功`)])
    }

    this.saveConfig()
  }
}
