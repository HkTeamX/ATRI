import type { NCWebsocketOptionsHost } from 'node-napcat-ts'
import process from 'node:process'
import { ATRI, definePlugin } from '@atri-bot/core'
import { LogLevel } from '@huan_kong/logger'

const debug = process.argv.includes('--debug')

const plugin = definePlugin({
  pluginName: '示例插件',
  install() {
    this.regCommandEvent({
      endPoint: 'message.private.friend',
      callback: async (message) => {
        this.logger.INFO('收到好友私聊消息', message)
      },
    })

    this.logger.INFO('示例插件安装了')
  },
  uninstall() {
    this.logger.INFO('示例插件卸载了')
  },
})

const plugin2 = definePlugin(() => {
  const vars = 1122

  return {
    pluginName: '示例插件-函数式',
    install() {
      this.logger.INFO('函数式插件, 可以在这里定义一些变量，或者进行一些异步操作，比如从数据库加载数据，或者从远程接口获取数据', vars)

      this.regCommandEvent({
        endPoint: 'message.private.friend',
        callback: async (message) => {
          this.logger.INFO('收到好友私聊消息', message)
        },
      })

      this.logger.INFO('示例插件安装了')
    },
    uninstall() {
      this.logger.INFO('示例插件卸载了')
    },
  }
})

const atri = new ATRI({
  logLevel: debug ? LogLevel.DEBUG : LogLevel.INFO,
  plugins: [plugin, plugin2],
  configDir: './config',
  botConfig: {
    prefix: JSON.parse(process.env.PREFIX ?? '["/"]'),
    adminId: JSON.parse(process.env.ADMIN_ID ?? '[10001]'),
    protocol: (process.env.NC_PROTOCOL ?? 'ws') as NCWebsocketOptionsHost['protocol'],
    host: process.env.NC_HOST ?? '127.0.0.1',
    port: Number.parseInt(process.env.NC_PORT ?? '3001'),
    accessToken: process.env.NC_ACCESS_TOKEN,
    reconnection: {
      enable: process.env.NC_RECONNECTION_ENABLE === 'true',
      attempts: Number.parseInt(process.env.NC_RECONNECTION_ATTEMPTS ?? '10'),
      delay: Number.parseInt(process.env.NC_RECONNECTION_DELAY ?? '5000'),
    },
  },
})

;(async () => {
  await atri.init()

  await atri.loadPlugin(plugin)
})()
