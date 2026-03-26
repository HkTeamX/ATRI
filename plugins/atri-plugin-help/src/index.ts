import type { CommandEvent } from '@atri-bot/core'
import { decodeUnicode, Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import PackageJson from '../package.json' with { type: 'json' }

export const helpCommander = yargs()
  .option('command', {
    alias: 'c',
    type: 'string',
    description: '显示指定命令的帮助文档',
  })
  .option('page', {
    alias: 'p',
    type: 'number',
    description: '页码',
    default: 1,
  })
  .option('size', {
    alias: 's',
    type: 'number',
    description: '每页条数',
    default: 8,
  })

export const helpRegexp = /help|帮助/

export async function handleFindCommand(commandEvents: CommandEvent[], command: string) {
  const matchedCommand = commandEvents.find((cmd) => {
    if (typeof cmd.trigger === 'string') {
      return cmd.trigger.startsWith(command)
    }
    else {
      return cmd.trigger.test(command)
    }
  })

  if (!matchedCommand || !matchedCommand.commander) {
    return [Structs.text('未找到该命令的帮助信息')]
  }

  const description = await matchedCommand.commander().getHelp()
  return [Structs.text(description)]
}

export async function handleCommandList(
  commandEvents: CommandEvent[],
  page: number,
  size: number,
  version: string,
  prefix: string,
) {
  const commandList = commandEvents
    .filter(cmd => !cmd.hideInHelp)
    .slice((page - 1) * size, page * size)
    .map((cmdEvent, index) => `${index + 1}. ${decodeUnicode(cmdEvent.trigger.toString())}`)

  return [
    Structs.text(`ATRI Bot v${version} - 命令列表 (第 ${page} 页)\n`),
    Structs.text(`使用 "${prefix}help -p <页码> -s <每页条数>" 来翻页\n`),
    Structs.text(`使用 "${prefix}help -c <命令>" 查看指定命令的帮助信息\n`),
    Structs.text(commandList.join('\n')),
  ]
}

export const plugin = new Plugin(PackageJson.name)
  .onInstall(({ event, bot, atri }) => {
    event.regCommandEvent({
      trigger: helpRegexp,
      commander: helpCommander,
      callback: async ({ context, options }) => {
        const { page, size, command } = options

        if (command) {
          const msg = await handleFindCommand(bot.events.command, command)
          await bot.sendMsg(context, msg)
          return
        }

        const msg = await handleCommandList(bot.events.command, page, size, atri.version, bot.config.prefix[0])
        await bot.sendMsg(context, msg)
      },
    })
  })
