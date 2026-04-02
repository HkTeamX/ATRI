import type { SendMessageSegment } from 'node-napcat-ts'
import { Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import packageJson from '../package.json' with { type: 'json' }

export interface PingConfig {
  defaultReply: string
}

export const plugin = new Plugin<PingConfig>(packageJson.name)
  .setDefaultConfig([
    {
      key: 'defaultReply',
      val: 'pong',
      comment: '默认回复内容',
      place: 'top',
    },
  ])

export const pingCommander = yargs()
  .option('reply', {
    alias: 'r',
    type: 'string',
    description: '自定义回复内容',
  })

export const p1ng = plugin.command('p1ng')
  .commander(pingCommander)
  .callback(async ({ context, options, bot, logger }, next) => {
    next()

    logger.DEBUG('Received p1ng command with options:', options)
    await bot.sendMsg(context, [Structs.text(options.reply ?? plugin.config.defaultReply)], { reply: false, at: false })
  })

export async function handlePingCommand(reply?: string, defaultReply?: string): Promise<SendMessageSegment[]> {
  return [Structs.text('p2ng\n'), Structs.text(reply ?? defaultReply ?? 'pong')]
}

export const p2ng = plugin.command('p2ng')
  .commander(pingCommander)
  .callback(async ({ context, options, bot, logger }, next) => {
    next()

    const msg = await handlePingCommand(options.reply, plugin.config.defaultReply)
    logger.DEBUG('Generated p2ng response:', msg)

    await bot.sendMsg(context, msg, { reply: false, at: false })
  })
