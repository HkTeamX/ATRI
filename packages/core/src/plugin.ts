import type { Logger } from '@huan_kong/logger'
import type { MessageHandler, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { ATRI } from './atri.js'
import type { CommandEvent, MessageEvent, NoticeEvent, RequestEvent } from './bot.js'
import type { MaybePromise } from './utils.js'

export interface PluginRuntime<T extends object = object, Extra extends object = object> {
  atri: ATRI
  bot: ATRI['bot']
  ws: ATRI['bot']['ws']
  config: T
  logger: Logger
  refreshConfig: () => Promise<void>
  saveConfig: (config?: T) => Promise<void>

  regMessageEvent: <K extends keyof MessageHandler>(this: Plugin<T, Extra>, event: Omit<MessageEvent<K>, 'type' | 'pluginName'>) => void
  regCommandEvent: <K extends keyof MessageHandler, U extends Argv>(this: Plugin<T, Extra>, event: Omit<CommandEvent<K, U>, 'type' | 'pluginName'>) => void
  regNoticeEvent: <K extends keyof NoticeHandler>(this: Plugin<T, Extra>, event: Omit<NoticeEvent<K>, 'type' | 'pluginName'>) => void
  regRequestEvent: <K extends keyof RequestHandler>(this: Plugin<T, Extra>, event: Omit<RequestEvent<K>, 'type' | 'pluginName'>) => void
}

export type Plugin<T extends object = object, Extra extends object = object> = PluginRuntime<T, Extra> & PluginOptions<T, Extra>

export type PluginOptions<T extends object = object, Extra extends object = object> = Extra & {
  defaultConfig?: T
  config?: T
  pluginName: string
  install: () => MaybePromise<void>
  uninstall: () => MaybePromise<void>
} & ThisType<Plugin<T, Extra>>

export type definePluginReturnType<T extends object, Extra extends object = object> = (atri: ATRI) => Promise<Plugin<T, Extra>>

export function definePlugin<T extends object, Extra extends object = object>(_pluginOptions: PluginOptions<T, Extra>): definePluginReturnType<T, Extra>
export function definePlugin<T extends object, Extra extends object = object>(_pluginOptions: () => MaybePromise<PluginOptions<T, Extra>>): definePluginReturnType<T, Extra>
export function definePlugin<T extends object, Extra extends object = object>(_pluginOptions: PluginOptions<T, Extra> | (() => MaybePromise<PluginOptions<T, Extra>>)): definePluginReturnType<T, Extra> {
  return async (atri: ATRI) => {
    const pluginOptions = await Promise.resolve(typeof _pluginOptions === 'function' ? _pluginOptions() : _pluginOptions)

    const plugin: Plugin<T, Extra> = {
      ...pluginOptions,

      atri,
      bot: atri.bot,
      ws: atri.bot.ws,
      config: pluginOptions.config ?? await atri.loadConfig<T>(pluginOptions.pluginName, pluginOptions.defaultConfig),
      logger: atri.logger.clone({ title: pluginOptions.pluginName }),
      refreshConfig: async () => {
        if (pluginOptions.config)
          return
        plugin.config = await atri.loadConfig<T>(pluginOptions.pluginName, pluginOptions.defaultConfig)
      },
      saveConfig: async (config?: T) => {
        if (pluginOptions.config)
          return
        await atri.saveConfig<T>(pluginOptions.pluginName, config ?? plugin.config)
      },
      regMessageEvent: event => atri.bot.regMessageEvent({ ...event, pluginName: pluginOptions.pluginName }),
      regCommandEvent: event => atri.bot.regCommandEvent({ ...event, pluginName: pluginOptions.pluginName }),
      regNoticeEvent: event => atri.bot.regNoticeEvent({ ...event, pluginName: pluginOptions.pluginName }),
      regRequestEvent: event => atri.bot.regRequestEvent({ ...event, pluginName: pluginOptions.pluginName }),
    }

    return plugin
  }
}
