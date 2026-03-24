import type { MessageContext } from '@atri-bot/core'
import type { SendMessageSegment } from 'node-napcat-ts'
import { definePlugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import PackageJson from '../package.json' with { type: 'json' }

const TheCakeIsALieRegexp = /^(the cake is a lie|蛋糕是个谎言)$/i
const messages: SendMessageSegment[] = [
  Structs.text('You Will Be Baked, And Then There Will Be Cake'),
  Structs.music('163', 2005125394),
  Structs.text('But The Cake Is A Lie'),
]

export const TheCakeIsALiePlugin = definePlugin(() => {
  return {
    pluginName: PackageJson.name,
    install() {
      this.regMessageEvent({
        trigger: TheCakeIsALieRegexp,
        callback: this.cakeIsALie.bind(this),
      })
    },
    uninstall() { },
    async cakeIsALie({ context }: MessageContext<'message'>) {
      messages.forEach(async (message, index) => {
        setTimeout(async () => {
          await this.bot.sendMsg(context, [message], { reply: false, at: false })
        }, index * 1000)
      })
    },
  }
})
