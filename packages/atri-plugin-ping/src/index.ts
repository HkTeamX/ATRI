import { BasePlugin, type CommandCallback } from '@atri-bot/core'
import { Command } from 'commander'
import { Structs } from 'node-napcat-ts'

export interface PingConfig {
  defaultReply: string
}

export interface PingCommandContext {
  args: [string?]
  params: { reply?: string }
}

export class Plugin extends BasePlugin<PingConfig> {
  pluginName = 'ping'
  disableAutoLoadConfig = false
  defaultConfig = {
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
    await this.bot.sendMsg(context, [
      Structs.text(args[0] ?? params.reply ?? this.config.defaultReply),
    ])
  }
}
