import { Structs, type SendMessageSegment } from 'node-napcat-ts'
import { BasePlugin } from '../plugin.js'
import type { MessageCallback } from '../reg_event.js'

export class Plugin extends BasePlugin {
  name = '🎂 This is a Cake'
  version = '1.0.0'
  auto_load_config = false

  init() {
    this.reg_message_event({
      regexp: /^(the cake is a lie|蛋糕是个谎言)$/i,
      callback: this.revealTheTruth.bind(this),
    })
  }

  private messages: SendMessageSegment[] = [
    Structs.text('You Will Be Baked, And Then There Will Be Cake'),
    Structs.music('163', 2005125394),
    Structs.text('But The Cake Is A Lie'),
  ]

  private async revealTheTruth({ context }: MessageCallback) {
    this.messages.forEach(async (message, index) => {
      setTimeout(async () => {
        await this.bot.send_msg(context, [message], { reply: false, at: false })
      }, index * 1000)
    })
  }
}
