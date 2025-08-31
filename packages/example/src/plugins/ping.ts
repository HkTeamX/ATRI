import { BasePlugin } from '@huan_kong/atri'
import { Command } from 'commander'
import { convertCQCodeToJSON, type SendMessageSegment } from 'node-napcat-ts'

export interface PingConfig {
  default_reply: string
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
    this.reg_command_event<
      'message',
      {
        params: { reply?: string }
        args: [string | undefined]
      }
    >({
      command_name: 'ping',
      commander: new Command()
        .description('检查Bot是否在线, 并返回指定内容')
        .option('-r, --reply <content>', '要回复的内容')
        .argument('[content]', '要回复的内容'),
      callback: async ({ context, params, args }) => {
        await this.bot.send_msg(
          context,
          convertCQCodeToJSON(
            params.reply ?? args[0] ?? this.config.default_reply,
          ) as SendMessageSegment[],
        )
      },
    })
  }
}
