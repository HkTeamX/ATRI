import type { Logger } from '@huan_kong/logger'
import type { MessageHandler, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { Argv } from 'yargs'
import type { ATRI } from './atri.js'
import type { CommandEvent, MessageEvent, NoticeEvent, RequestEvent } from './bot.js'
import type { MaybePromise } from './utils.js'

export interface Plugin<T extends object = object> extends PluginOptions<T> {
  atri: ATRI
  bot: ATRI['bot']
  ws: ATRI['bot']['ws']
  config: T
  logger: Logger
  refreshConfig: () => Promise<void>
  saveConfig: (config?: T) => Promise<void>

  regMessageEvent: <K extends keyof MessageHandler>(this: Plugin<T>, event: Omit<MessageEvent<K>, 'type' | 'pluginName'>) => void
  regCommandEvent: <K extends keyof MessageHandler, U extends Argv>(this: Plugin<T>, event: Omit<CommandEvent<K, U>, 'type' | 'pluginName'>) => void
  regNoticeEvent: <K extends keyof NoticeHandler>(this: Plugin<T>, event: Omit<NoticeEvent<K>, 'type' | 'pluginName'>) => void
  regRequestEvent: <K extends keyof RequestHandler>(this: Plugin<T>, event: Omit<RequestEvent<K>, 'type' | 'pluginName'>) => void
}

export interface PluginOptions<T extends object = object> {
  defaultConfig?: T
  pluginName: string
  install: (this: Plugin<T>) => MaybePromise<void>
  uninstall: (this: Plugin<T>) => MaybePromise<void>
}

export type definePluginReturnType<T extends object> = (atri: ATRI) => Promise<Plugin<T>>

export function definePlugin<T extends object>(_pluginOptions: PluginOptions<T> | (() => MaybePromise<PluginOptions<T>>)): definePluginReturnType<T> {
  return async (atri: ATRI) => {
    const pluginOptions = await Promise.resolve(typeof _pluginOptions === 'function' ? _pluginOptions() : _pluginOptions)

    const plugin: Plugin<T> = {
      ...pluginOptions,

      atri,
      bot: atri.bot,
      ws: atri.bot.ws,
      config: await atri.loadConfig<T>(pluginOptions.pluginName, pluginOptions.defaultConfig),
      logger: atri.logger.clone({ title: pluginOptions.pluginName }),
      refreshConfig: async () => { plugin.config = await atri.loadConfig<T>(pluginOptions.pluginName, pluginOptions.defaultConfig) },
      saveConfig: async (config?: T) => { await atri.saveConfig<T>(pluginOptions.pluginName, config ?? plugin.config) },

      regMessageEvent: event => atri.bot.regMessageEvent({ ...event, pluginName: pluginOptions.pluginName }),
      regCommandEvent: event => atri.bot.regCommandEvent({ ...event, pluginName: pluginOptions.pluginName }),
      regNoticeEvent: event => atri.bot.regNoticeEvent({ ...event, pluginName: pluginOptions.pluginName }),
      regRequestEvent: event => atri.bot.regRequestEvent({ ...event, pluginName: pluginOptions.pluginName }),
    }

    return plugin
  }
}
