import type { SendMessageSegment } from 'node-napcat-ts'
import { Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import PackageJson from '../package.json' with { type: 'json' }

export const TheCakeIsALieRegexp = /^(the cake is a lie|蛋糕是个谎言)$/i
export const messages: SendMessageSegment[] = [
  Structs.text('You Will Be Baked, And Then There Will Be Cake'),
  Structs.music('163', 2005125394),
  Structs.text('But The Cake Is A Lie'),
]

export const plugin = new Plugin(PackageJson.name)
  .onInstall(({ event, bot }) => {
    event.regMessageEvent({
      trigger: TheCakeIsALieRegexp,
      callback: ({ context }, next) => {
        next()

        messages.forEach((message, index) => {
          setTimeout(() => bot.sendMsg(context, [message], { reply: false, at: false }), index * 1000)
        })
      },
    })
  })
