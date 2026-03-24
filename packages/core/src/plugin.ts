import type { Logger } from '@huan_kong/logger'
import type { MessageHandler, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { ATRI } from './atri.js'
import type { CommandEvent, MessageEvent, NoticeEvent, RequestEvent } from './bot.js'
import type { MaybePromise } from './utils.js'

export interface PluginRuntime<TExtraFields extends object, TConfig extends object> {
  atri: ATRI
  bot: ATRI['bot']
  ws: ATRI['bot']['ws']
  config: TConfig
  logger: Logger
  refreshConfig: () => Promise<void>
  saveConfig: (config?: TConfig) => Promise<void>

  regMessageEvent: <K extends keyof MessageHandler>(this: Plugin<TExtraFields, TConfig>, event: Omit<MessageEvent<K>, 'type' | 'pluginName'>) => void
  regCommandEvent: <K extends keyof MessageHandler, U extends Argv>(this: Plugin<TExtraFields, TConfig>, event: Omit<CommandEvent<K, U>, 'type' | 'pluginName'>) => void
  regNoticeEvent: <K extends keyof NoticeHandler>(this: Plugin<TExtraFields, TConfig>, event: Omit<NoticeEvent<K>, 'type' | 'pluginName'>) => void
  regRequestEvent: <K extends keyof RequestHandler>(this: Plugin<TExtraFields, TConfig>, event: Omit<RequestEvent<K>, 'type' | 'pluginName'>) => void
}

export interface PluginBaseOptions<TConfig extends object> {
  defaultConfig?: TConfig
  config?: TConfig
  pluginName: string
  install: () => MaybePromise<void>
  uninstall: () => MaybePromise<void>
}

export type PluginOptions<TExtraFields extends object, TConfig extends object>
  = TExtraFields
    & PluginBaseOptions<TConfig>
    & ThisType<Plugin<TExtraFields, TConfig>>

export type Plugin<TExtraFields extends object, TConfig extends object>
  = PluginRuntime<TExtraFields, TConfig>
    & PluginOptions<TExtraFields, TConfig>

export type definePluginReturnType<TExtraFields extends object, TConfig extends object> = (atri: ATRI) => Promise<Plugin<TExtraFields, TConfig>>

export function definePlugin<TExtraFields extends object = object, TConfig extends object = object, TRealExtraFields extends object = Omit<TExtraFields, keyof PluginBaseOptions<TConfig>>>(pluginOptions: PluginOptions<TRealExtraFields, TConfig>): definePluginReturnType<TRealExtraFields, TConfig>
export function definePlugin<TExtraFields extends object = object, TConfig extends object = object, TRealExtraFields extends object = Omit<TExtraFields, keyof PluginBaseOptions<TConfig>>>(pluginOptions: () => MaybePromise<PluginOptions<TRealExtraFields, TConfig>>): definePluginReturnType<TRealExtraFields, TConfig>
export function definePlugin<TExtraFields extends object = object, TConfig extends object = object, TRealExtraFields extends object = Omit<TExtraFields, keyof PluginBaseOptions<TConfig>>>(pluginOptions: PluginOptions<TRealExtraFields, TConfig> | (() => MaybePromise<PluginOptions<TRealExtraFields, TConfig>>)): definePluginReturnType<TRealExtraFields, TConfig> {
  return async (atri: ATRI) => {
    const computedPluginOptions = await Promise.resolve(typeof pluginOptions === 'function' ? pluginOptions() : pluginOptions)

    const plugin: Plugin<TRealExtraFields, TConfig> = {
      ...computedPluginOptions,

      atri,
      bot: atri.bot,
      ws: atri.bot.ws,
      config: computedPluginOptions.config ?? await atri.loadConfig<TConfig>(computedPluginOptions.pluginName, computedPluginOptions.defaultConfig),
      logger: atri.logger.clone({ title: computedPluginOptions.pluginName }),
      refreshConfig: async () => {
        if (computedPluginOptions.config)
          return
        plugin.config = await atri.loadConfig<TConfig>(computedPluginOptions.pluginName, computedPluginOptions.defaultConfig)
      },
      saveConfig: async (config?: TConfig) => {
        if (computedPluginOptions.config)
          return
        await atri.saveConfig<TConfig>(computedPluginOptions.pluginName, config ?? plugin.config)
      },
      regMessageEvent: event => atri.bot.regMessageEvent({ ...event, pluginName: computedPluginOptions.pluginName }),
      regCommandEvent: event => atri.bot.regCommandEvent({ ...event, pluginName: computedPluginOptions.pluginName }),
      regNoticeEvent: event => atri.bot.regNoticeEvent({ ...event, pluginName: computedPluginOptions.pluginName }),
      regRequestEvent: event => atri.bot.regRequestEvent({ ...event, pluginName: computedPluginOptions.pluginName }),
    }

    return plugin
  }
}
