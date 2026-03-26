import type { CommandContext } from '@atri-bot/core'
import type { SendMessageSegment } from 'node-napcat-ts'
import { Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import packageJson from '../package.json' with { type: 'json' }

export const pingCommander = yargs().option('reply', {
  alias: 'r',
  type: 'string',
  description: '自定义回复内容',
})

export async function handlePingCommand({ options }: CommandContext<'message', typeof pingCommander>, defaultReply: string): Promise<SendMessageSegment[]> {
  return [Structs.text('p2ng\n'), Structs.text(options.reply ?? defaultReply)]
}

export const plugin = new Plugin(packageJson.name)
  .setDefaultConfig({
    defaultReply: 'pong',
  })
  .onInstall(
    ({ bot, logger, event, config }) => {
      event.regCommandEvent({
        trigger: 'ping',
        commander: pingCommander,
        callback: async ({ context, options }) => {
          logger.INFO('Received ping command with options:', options)
          await bot.sendMsg(context, [Structs.text(options.reply ?? config.defaultReply)], { reply: false, at: false })
        },
      })

      event.regCommandEvent({
        trigger: 'p2ng',
        commander: pingCommander,
        callback: async ({ context, options }) => {
          logger.INFO('Received p2ng command with options:', options)
          const msg = await handlePingCommand({ context, options }, config.defaultReply)
          await bot.sendMsg(context, msg, { reply: false, at: false })
        },
      })
    },
  )
