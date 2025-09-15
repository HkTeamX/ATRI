import { ATRI, type BotConfig } from '@atri-bot/core'
import { config } from 'dotenv'
import { Structs, type NCWebsocketOptionsHost } from 'node-napcat-ts'
import path from 'node:path'
import process from 'node:process'

config({
  path: path.join(import.meta.dirname, '../.env'),
  quiet: true,
})

const debug = process.argv.includes('--debug')

const botConfig: BotConfig = {
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
  debug,
  bot: botConfig,
  baseDir: import.meta.dirname,
  plugins: ['@atri-bot/plugin-plugin-store'],
})

if (!debug) {
  await Promise.all(
    botConfig.adminId.map((id) =>
      atri.bot.sendMsg({ message_type: 'private', user_id: id }, [
        Structs.text('アトリは、高性能ですから！'),
      ]),
    ),
  )
}
