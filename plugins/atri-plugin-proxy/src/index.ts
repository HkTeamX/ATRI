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

export const Plugin = definePlugin<object, ProxyConfig>({
  pluginName: PackageJson.name,
  defaultConfig: {
    enable: false,
  },
  install() {
    if (!this.config.enable) {
      return
    }

    if (!this.config.proxy?.http || !this.config.proxy?.https) {
      this.logger.ERROR('代理配置不完整，请检查配置项 proxy.http 和 proxy.https 是否正确')
      return
    }

    proxy.setConfig(this.config.proxy)
    proxy.start()
  },
  uninstall() {
    proxy.stop()
  },
})
