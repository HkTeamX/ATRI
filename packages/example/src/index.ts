import { ATRI, type BotConfig } from '@atri-bot/core'
import { config } from 'dotenv'
import type { NCWebsocketOptionsHost } from 'node-napcat-ts'
import path from 'node:path'
import process from 'node:process'

config({
  path: path.join(import.meta.dirname, '../.env'),
  quiet: true,
})

const debug = process.argv.includes('--debug')

const bot: BotConfig = {
  prefix: JSON.parse(process.env.PREFIX ?? '["/"]'),
  adminId: JSON.parse(process.env.ADMIN_ID ?? '[10001]'),
  connection: {
    protocol: (process.env.NC_PROTOCOL ?? 'ws') as NCWebsocketOptionsHost['protocol'],
    host: process.env.NC_HOST ?? '127.0.0.1',
    port: parseInt(process.env.NC_PORT ?? '3001'),
    accessToken: process.env.NC_ACCESS_TOKEN,
  },
  reconnection: {
    enable: process.env.NC_RECONNECTION_ENABLE === 'true',
    attempts: parseInt(process.env.NC_RECONNECTION_ATTEMPTS ?? '10'),
    delay: parseInt(process.env.NC_RECONNECTION_DELAY ?? '5000'),
  },
}

const atri = await ATRI.init({
  bot,
  debug,
  baseDir: import.meta.dirname,
  // 如果需要插件商城的相关功能, 比如禁用插件等, 请第一个加载 '@atri-bot/plugin-plugin-store' 插件
  plugins: ['@atri-bot/plugin-plugin-store'],
})

await Promise.all(
  ['@atri-bot/plugin-ping', '@atri-bot/plugin-help', '@atri-bot/plugin-the-cake-is-a-lie'].map(
    (packageName) => atri.loadPlugin(packageName),
  ),
)
