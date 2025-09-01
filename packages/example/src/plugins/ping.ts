import { BasePlugin, type CommandCallback } from '@huan_kong/atri'
import { Command } from 'commander'
import { convertCQCodeToJSON, type SendMessageSegment } from 'node-napcat-ts'

export interface PingConfig {
  default_reply: string
}

export type PingCommandContext = {
  params: { reply?: string }
  args: [string | undefined]
}

export class Plugin extends BasePlugin<PingConfig> {
  name = 'ping'
  version = '1.0.0'
  dependencies = {
    call: '^1.0.0',
  }

  config_name = 'ping_config'
  default_config: PingConfig = {
    default_reply: 'pong',
  }

  init() {
    this.reg_command_event({
      end_point: 'message.private',
      command_name: 'ping',
      commander: new Command()
        .description('检查Bot是否在线, 并返回指定内容')
        .option('-r, --reply <content>', '要回复的内容')
        .argument('[content]', '要回复的内容'),
      callback: this.handle_on_ping.bind(this),
    })
  }

  /**
   * 处理 ping 命令
   */
  private async handle_on_ping({
    context,
    params,
    args,
  }: CommandCallback<PingCommandContext, 'message.private'>) {
    await this.bot.send_msg(
      context,
      convertCQCodeToJSON(
        params.reply ?? args[0] ?? this.config.default_reply,
      ) as SendMessageSegment[],
    )
  }
}
