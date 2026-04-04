import type { Logger } from '@huan_kong/logger'
import type { ATRI, ConfigItem } from '@/atri.js'
import type { Bot } from '@/bot.js'
import type { MaybePromise } from '@/utils.js'
import { ATRICommand } from '@/plugin/events/command.js'
import { ATRIMessage } from '@/plugin/events/message.js'
import { ATRINotice } from '@/plugin/events/notice.js'
import { ATRIRequest } from '@/plugin/events/request.js'

export const pluginSymbol = Symbol.for('atri_plugin')

export interface PluginContext<TConfig extends object> {
  config: TConfig
  atri: ATRI
  bot: Bot
  ws: Bot['ws']
  logger: Logger
}

export type PluginHandler<TConfig extends object> = (context: PluginContext<TConfig>) => MaybePromise<void>

export class Plugin<TConfig extends object> {
  pluginName: string
  defaultConfig?: ConfigItem<TConfig>[]
  installHandler?: PluginHandler<TConfig>
  uninstallHandler?: PluginHandler<TConfig>
  symbol = pluginSymbol

  constructor(pluginName: string) {
    this.pluginName = pluginName
  }

  onInstall(handler: PluginHandler<TConfig>) {
    this.installHandler = handler
    return this
  }

  onUninstall(handler: PluginHandler<TConfig>) {
    this.uninstallHandler = handler
    return this
  }

  setDefaultConfig(config: ConfigItem<TConfig>[]) {
    this.defaultConfig = config
    return this
  }

  command(trigger: string | RegExp) {
    return new ATRICommand<'message', any, TConfig>(this.pluginName, trigger)
  }

  message(trigger?: string | RegExp) {
    return new ATRIMessage<'message', TConfig>(this.pluginName, trigger)
  }

  notice() {
    return new ATRINotice<'notice', TConfig>(this.pluginName)
  }

  request() {
    return new ATRIRequest<'request', TConfig>(this.pluginName)
  }
}
