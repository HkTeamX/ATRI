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

// .onInstall(({ config }) => {
//   if (!config.enable) {
//     return
//   }

//   if (!config.proxy?.http || !config.proxy?.https) {
//     console.error('代理配置不完整，请检查配置项 proxy.http 和 proxy.https 是否正确')
//     return
//   }

//   proxy.setConfig(config.proxy)
//   proxy.start()
// })
// .onUninstall(() => {
//   proxy.stop()
// })
