import { BasePlugin } from '@atri-bot/core'
import proxy from '@huan_kong/node-global-proxy'

export type ProxyConfig
  = | {
    enable: false
  }
  | {
    enable: true
    proxy: {
      http: string
      https: string
    }
  }

export class Plugin extends BasePlugin<ProxyConfig> {
  defaultConfig: ProxyConfig = {
    enable: false,
  }

  load() {
    if (!this.config.enable)
      return
    proxy.setConfig(this.config.proxy)
    proxy.start()
  }

  unload() {
    proxy.stop()
  }
}
