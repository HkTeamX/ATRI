import type { SendMessageSegment } from 'node-napcat-ts'
import { Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import PackageJson from '../package.json' with { type: 'json' }

export const plugin = new Plugin(PackageJson.name)

export const messages: SendMessageSegment[] = [
  Structs.text('You Will Be Baked, And Then There Will Be Cake'),
  Structs.music('163', 2005125394),
  Structs.text('But The Cake Is A Lie'),
]

export const theCakeIsALie = plugin
  .message(/the cake is a lie|蛋糕是个谎言/)
  .callback(({ context, bot }, next) => {
    next()

    messages.forEach((message, index) => {
      setTimeout(() => bot.sendMsg(context, [message], { reply: false, at: false }), index * 1000)
    })
  })
