import type { ATRI, ConfigItem } from '@/atri.js'
import { ATRICommand } from '@/plugin/events/command.js'
import { ATRIMessage } from '@/plugin/events/message.js'
import { ATRINotice } from '@/plugin/events/notice.js'
import { ATRIRequest } from '@/plugin/events/request.js'

export class Plugin<TConfig extends object> {
  pluginName: string
  config: TConfig
  defaultConfig?: ConfigItem<TConfig>[]
  atri!: ATRI

  constructor(pluginName: string) {
    this.pluginName = pluginName
    this.config = {} as TConfig
  }

  setDefaultConfig(config: ConfigItem<TConfig>[]) {
    this.defaultConfig = config
    return this
  }

  setConfig(config: TConfig) {
    this.config = config
    return this
  }

  inject(atri: ATRI) {
    this.atri = atri
  }

  async refreshConfig() {
    const config = await this.atri.loadConfig(this.pluginName, this.defaultConfig, true)
    this.config = config
    return config
  }

  async saveConfig(config: TConfig) {
    this.config = config
    await this.atri.saveConfig(this.pluginName, config)
    return true
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
