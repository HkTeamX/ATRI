import type { NCWebsocketOptionsHost } from 'node-napcat-ts'
import process from 'node:process'
import { ATRI } from '@atri-bot/core'
import { InitDbPlugin } from '@atri-bot/lib-db'
import { HelpPlugin } from '@atri-bot/plugin-help'
import { PingPlugin } from '@atri-bot/plugin-ping'
import { ProxyPlugin } from '@atri-bot/plugin-proxy'
import { TheCakeIsALiePlugin } from '@atri-bot/plugin-the-cake-is-a-lie'
import { LogLevel } from '@huan_kong/logger'

const debug = process.argv.includes('--debug')

const atri = new ATRI({
  logLevel: debug ? LogLevel.DEBUG : LogLevel.INFO,
  plugins: [
    PingPlugin,
    ProxyPlugin,
    TheCakeIsALiePlugin,
    HelpPlugin,
    InitDbPlugin({
      connectString: process.env.DATABASE_URL ?? '',
    }),
  ],
  configDir: './config',
  logDir: './logs',
  saveLogs: !debug,
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

atri.init()
