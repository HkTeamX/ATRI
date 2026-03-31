import type { MessageHandler, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { ATRI } from './atri.js'
import type { CommandEvent, MessageEvent, NoticeEvent, RequestEvent } from './bot.js'
import type { ConversationBuilder } from './builder.js'
import type { MaybePromise } from './utils.js'

export const buildStatus = {
  pending: 'pending',
  built: 'built',
} as const

export type BuildStatus = typeof buildStatus[keyof typeof buildStatus]

export interface PluginRuntimeContext<TContext extends object, TConfig extends object> {
  context: TContext
  config: TConfig
  defaultConfig: TConfig
  pluginName: string

  plugin: Plugin<TContext, TConfig>
  atri: ATRI
  bot: ATRI['bot']
  ws: ATRI['bot']['ws']
  logger: ATRI['logger']
  refreshConfig: () => Promise<void>
  saveConfig: (config?: TConfig) => Promise<void>

  event: {
    regMessageEvent: <K extends keyof MessageHandler>(event: Omit<MessageEvent<K>, 'type' | 'pluginName'>) => () => void
    regCommandEvent: <K extends keyof MessageHandler, U extends Argv>(event: Omit<CommandEvent<K, U>, 'type' | 'pluginName' | 'callback'> & { callback: CommandEvent<K, U>['callback'] | ConversationBuilder<K, U, any> }) => () => void
    regNoticeEvent: <K extends keyof NoticeHandler>(event: Omit<NoticeEvent<K>, 'type' | 'pluginName'>) => () => void
    regRequestEvent: <K extends keyof RequestHandler>(event: Omit<RequestEvent<K>, 'type' | 'pluginName'>) => () => void
  }
}

export type PluginOnFn<TContext extends object, TConfig extends object> = (context: PluginRuntimeContext<TContext, TConfig>) => MaybePromise<void>

export interface PluginDefineContext<TContext extends object, TConfig extends object> {
  context: TContext
  config: TConfig
  pluginName: string
}

export class Plugin<TContext extends object, TConfig extends object> {
  private pluginName: string
  private context: TContext = {} as TContext
  private setupTasks: Array<() => Promise<void>> = []
  private buildStatus: BuildStatus = buildStatus.pending
  private installed = false
  private installFn: PluginOnFn<TContext, TConfig> = () => {}
  private uninstallFn: PluginOnFn<TContext, TConfig> = () => {}
  private defaultConfig: TConfig = {} as TConfig
  private config: TConfig = {} as TConfig
  private atri!: ATRI
  private bot!: ATRI['bot']
  private logger!: ATRI['logger']
  private ws!: ATRI['bot']['ws']

  constructor(pluginName: string) {
    this.pluginName = pluginName
  }

  define<V extends object | string | number, K extends string = string>(
    key: K,
    value: V | ((plugin: PluginDefineContext<TContext, TConfig>) => MaybePromise<V>),
  ): Plugin<TContext & Record<K, V>, TConfig> {
    this.buildStatus = buildStatus.pending

    this.setupTasks.push(async () => {
      const resolved = typeof value === 'function'
        ? await value({
            context: this.context,
            config: this.config,
            pluginName: this.pluginName,
          })
        : value

      ;(this.context as any)[key] = resolved
    })

    return this as any
  }

  async build(): Promise<this> {
    if (this.buildStatus === buildStatus.built) {
      return this
    }

    while (this.setupTasks.length > 0) {
      const task = this.setupTasks.shift()
      if (task) {
        await task()
      }
    }

    this.buildStatus = buildStatus.built

    return this
  }

  setDefaultConfig<Config extends TConfig>(config: Config): Plugin<TContext, Config> {
    this.defaultConfig = config
    return this as unknown as Plugin<TContext, Config>
  }

  setConfig(config: TConfig) {
    this.config = config
    return this
  }

  onInstall(fn: PluginOnFn<TContext, TConfig>) {
    this.installFn = fn
    return this
  }

  onUninstall(fn: PluginOnFn<TContext, TConfig>) {
    this.uninstallFn = fn
    return this
  }

  private async emit(fn: PluginOnFn<TContext, TConfig>) {
    await fn({
      plugin: this,
      pluginName: this.pluginName,
      config: this.config,
      defaultConfig: this.defaultConfig,
      context: this.context,
      atri: this.atri,
      bot: this.bot,
      ws: this.ws,
      logger: this.logger,
      refreshConfig: async () => { this.config = await this.atri.loadConfig(this.pluginName, this.defaultConfig) },
      saveConfig: async (config) => { await this.atri.saveConfig(this.pluginName, config ?? this.config) },

      event: {
        regMessageEvent: (event) => {
          return this.bot.regMessageEvent({
            ...event,
            pluginName: this.pluginName,
          })
        },
        regCommandEvent: (event) => {
          return this.bot.regCommandEvent({
            ...event,
            pluginName: this.pluginName,
          })
        },
        regNoticeEvent: (event) => {
          return this.bot.regNoticeEvent({
            ...event,
            pluginName: this.pluginName,
          })
        },
        regRequestEvent: (event) => {
          return this.bot.regRequestEvent({
            ...event,
            pluginName: this.pluginName,
          })
        },
      },
    })
  }

  async emitInstall(atri: ATRI) {
    if (this.installed) {
      return
    }

    this.atri = atri
    this.bot = atri.bot
    this.logger = atri.logger.clone({
      title: this.pluginName,
    })
    this.ws = atri.bot.ws
    this.config = await atri.loadConfig(this.pluginName, this.defaultConfig)

    await this.emit(this.installFn)

    this.installed = true
    return this
  }

  async emitUninstall() {
    if (!this.installed) {
      return
    }

    await this.emit(this.uninstallFn)

    this.installed = false
    return this
  }

  getPluginName(): string {
    return this.pluginName
  }

  getBuildStatus(): BuildStatus {
    return this.buildStatus
  }
}
