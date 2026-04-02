import { ATRICommand } from '@/plugin/events/command.js'
import { ATRIMessage } from '@/plugin/events/message.js'
import { ATRINotice } from '@/plugin/events/notice.js'
import { ATRIRequest } from '@/plugin/events/request.js'

export class Plugin<TConfig extends object> {
  pluginName: string
  config: TConfig
  defaultConfig?: TConfig

  constructor(pluginName: string) {
    this.pluginName = pluginName
    this.config = {} as TConfig
  }

  setDefaultConfig<TNewConfig extends object>(config: TNewConfig): Plugin<TNewConfig> {
    this.defaultConfig = config as unknown as TConfig
    return this as unknown as Plugin<TNewConfig>
  }

  setConfig(config: TConfig) {
    this.config = config
    return this
  }

  command(trigger: string | RegExp) {
    return new ATRICommand(this.pluginName, trigger)
  }

  message(trigger?: string | RegExp) {
    return new ATRIMessage(this.pluginName, trigger)
  }

  notice() {
    return new ATRINotice(this.pluginName)
  }

  request() {
    return new ATRIRequest(this.pluginName)
  }
}
