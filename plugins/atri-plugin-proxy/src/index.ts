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
  .onInstall(({ config, logger }) => {
    if (!config.enable || config.proxy.http === '' || config.proxy.https === '') {
      logger.INFO('全局代理未启用')
      return
    }

    proxy.setConfig(config.proxy)
    proxy.start()
    logger.INFO('全局代理已启用')
  })
  .onUninstall(({ logger }) => {
    proxy.stop()
    logger.INFO('全局代理已停用')
  })
