import type { Logger } from '@huan_kong/logger'
import type { MaybePromise } from 'bun'
import type { MessageHandler, NoticeHandler, RequestHandler } from 'node-napcat-ts'
import type { ATRI } from './atri.js'
import type { MessageEvent, NoticeEvent, RequestEvent } from './bot.js'

export interface Plugin<T extends object = object> extends PluginOptions<T> {
  atri: ATRI
  bot: ATRI['bot']
  ws: ATRI['bot']['ws']
  config: T
  logger: Logger
  refreshConfig: () => Promise<void>
  saveConfig: (config?: T) => Promise<void>
  regMessageEvent: <K extends keyof MessageHandler>(this: Plugin<T>, event: Omit<MessageEvent<K>, 'type' | 'pluginName'>) => void
  regCommandEvent: <K extends keyof MessageHandler>(this: Plugin<T>, event: Omit<MessageEvent<K>, 'type' | 'pluginName'>) => void
  regNoticeEvent: <K extends keyof NoticeHandler>(this: Plugin<T>, event: Omit<NoticeEvent<K>, 'type' | 'pluginName'>, atri: ATRI) => void
  regRequestEvent: <K extends keyof RequestHandler>(this: Plugin<T>, event: Omit<RequestEvent<K>, 'type' | 'pluginName'>, atri: ATRI) => void
}

export interface PluginOptions<T extends object = object> {
  defaultConfig?: T
  pluginName: string
  install: (this: Plugin<T>) => MaybePromise<void>
  uninstall: (this: Plugin<T>) => MaybePromise<void>
}

export type definePluginReturnType<T extends object> = (atri: ATRI) => Promise<Plugin<T>>

export function definePlugin<T extends object>(_pluginOptions: PluginOptions<T> | (() => MaybePromise<PluginOptions<T>>)): definePluginReturnType<T> {
  const eventUnloader: (() => void)[] = []

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
      regMessageEvent(event) {
        const unload = atri.bot.regMessageEvent({
          ...event,
          pluginName: pluginOptions.pluginName,
        })
        eventUnloader.push(unload)
        return unload
      },
      regCommandEvent(event) {
        const unload = atri.bot.regCommandEvent({
          ...event,
          pluginName: pluginOptions.pluginName,
        })
        eventUnloader.push(unload)
        return unload
      },
      regNoticeEvent(event) {
        const unload = atri.bot.regNoticeEvent({
          ...event,
          pluginName: pluginOptions.pluginName,
        })
        eventUnloader.push(unload)
        return unload
      },
      regRequestEvent(event) {
        const unload = atri.bot.regRequestEvent({
          ...event,
          pluginName: pluginOptions.pluginName,
        })
        eventUnloader.push(unload)
        return unload
      },
      uninstall() {
        eventUnloader.forEach(unload => unload())
        plugin.uninstall.call(this)
      },
    }

    return plugin
  }
}
