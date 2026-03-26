import { Plugin } from '@atri-bot/core'
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

export const plugin = new Plugin(PackageJson.name)
  .setDefaultConfig<ProxyConfig>({
    enable: false,
  })
  .onInstall(({ config }) => {
    if (!config.enable) {
      return
    }

    if (!config.proxy?.http || !config.proxy?.https) {
      console.error('代理配置不完整，请检查配置项 proxy.http 和 proxy.https 是否正确')
      return
    }

    proxy.setConfig(config.proxy)
    proxy.start()
  })
  .onUninstall(() => {
    proxy.stop()
  })
