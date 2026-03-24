import { definePlugin } from '@atri-bot/core'
import proxy from '@huan_kong/node-global-proxy'
import PackageJson from '../package.json' with { type: 'json' }

export type ProxyConfig
  = | { enable: false }
    | {
      enable: true
      proxy: {
        http: string
        https: string
      }
    }

export const ProxyPlugin = definePlugin<object, ProxyConfig>({
  pluginName: PackageJson.name,
  defaultConfig: {
    enable: false,
  },
  install() {
    if (!this.config.enable) {
      return
    }
    proxy.setConfig(this.config.proxy)
    proxy.start()
  },
  uninstall() {
    proxy.stop()
  },
})
