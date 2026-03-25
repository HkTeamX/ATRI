import type { CommandContext } from '@atri-bot/core'
import { definePlugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import packageJson from '../package.json' with { type: 'json' }

export interface PingPluginProps {
  pingCommander: typeof pingCommander
  handlePingCommand: (context: CommandContext<'message', typeof pingCommander>) => Promise<void>
}

export interface PingPluginConfig {
  defaultReply: string
}

const pingCommander = yargs().option('reply', {
  alias: 'r',
  type: 'string',
  description: '自定义回复内容',
})

export const Plugin = definePlugin<PingPluginProps, PingPluginConfig>({
  pluginName: packageJson.name,
  defaultConfig: {
    defaultReply: 'pong',
  },
  install() {
    this.regCommandEvent({
      trigger: 'ping',
      commander: pingCommander,
      callback: async ({ context, options }) => {
        await this.bot.sendMsg(
          context,
          [Structs.text(options.reply ?? this.config.defaultReply)],
          { reply: false, at: false },
        )
      },
    })

    this.regCommandEvent({
      trigger: 'ping2',
      commander: pingCommander,
      callback: this.handlePingCommand.bind(this),
    })
  },
  uninstall() {},
  pingCommander,

  async handlePingCommand({ context, options }: CommandContext<'message', typeof pingCommander>) {
    await this.bot.sendMsg(
      context,
      [Structs.text(options.reply ?? this.config.defaultReply)],
      { reply: false, at: false },
    )
  },
})
