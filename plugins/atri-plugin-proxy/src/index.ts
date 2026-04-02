import { Plugin } from '@atri-bot/core'
import proxy from '@huan_kong/node-global-proxy'
import PackageJson from '../package.json' with { type: 'json' }

export interface ProxyConfig {
  enable: boolean
  proxy: {
    http: string
    https: string
  }
}

export const plugin = new Plugin<ProxyConfig>(PackageJson.name)
  .setDefaultConfig([
    {
      key: 'enable',
      val: false,
      comment: '是否启用全局代理',
    },
    {
      key: 'proxy',
      val: {
        http: '',
        https: '',
      },
      comment: '代理配置',
    },
  ])
  .onInstall(() => {
    if (!plugin.config.enable || plugin.config.proxy.http === '' || plugin.config.proxy.https === '') {
      return
    }

    proxy.setConfig(plugin.config.proxy)
    proxy.start()
  })
  .onUninstall(() => {
    proxy.stop()
  })
