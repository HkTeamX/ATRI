import type { CommandCallback } from '@atri-bot/core'
import type { SendMessageSegment } from 'node-napcat-ts'
import { BasePlugin } from '@atri-bot/core'
import { Command } from 'commander'
import { convertCQCodeToJSON } from 'node-napcat-ts'

export interface PingConfig {
  defaultReply: string
}

export interface PingCommandContext {
  args: [string?]
  params: { reply?: string }
}

export class Plugin extends BasePlugin<PingConfig> {
  defaultConfig: PingConfig = {
    defaultReply: 'pong',
  }

  load() {
    this.regCommandEvent({
      commandName: 'ping',
      commander: new Command()
        .description('测试机器人是否在线')
        .argument('[reply]', '回复内容')
        .option('-r, --reply [reply]', '回复内容'),
      callback: this.handlePingCommand.bind(this),
    })
  }

  unload() {}

  private async handlePingCommand({ context, args, params }: CommandCallback<PingCommandContext>) {
    await this.bot.sendMsg(
      context,
      convertCQCodeToJSON(
        params.reply ?? args[0] ?? this.config.defaultReply,
      ) as SendMessageSegment[],
      { reply: false, at: false },
    )
  }
}
