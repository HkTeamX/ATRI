# 使用

推荐安装基础插件 `@atri-bot/plugin-plugin-store` 后续插件通过此插件安装

```ts
// 导入 ATRI 类
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

await ATRI.init({
  bot,
  debug,
  baseDir: import.meta.dirname,
  plugins: ['@atri-bot/plugin-plugin-store'],
})
```
