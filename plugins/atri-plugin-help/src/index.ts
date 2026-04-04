import type { CommandEvent } from '@atri-bot/core'
import { decodeUnicode, Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import PackageJson from '../package.json' with { type: 'json' }

export const plugin = new Plugin(PackageJson.name)

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

export async function handleFindCommand(commandEvents: CommandEvent[], command: string) {
  const matchedCommand = commandEvents.find((cmd) => {
    if (typeof cmd.trigger === 'string') {
      return cmd.trigger === command
    }
    else {
      return cmd.trigger.test(command)
    }
  })

  if (!matchedCommand || !matchedCommand.commander) {
    return '未找到该命令的帮助信息'
  }

  const description = await matchedCommand.commander().getHelp()
  return description
}

export async function handleCommandList(
  commandEvents: CommandEvent[],
  page: number,
  size: number,
  prefix: string,
  name: string,
  version: string,
  atriVersion: string,
) {
  const commandList = commandEvents
    .slice((page - 1) * size, page * size)
    .map((cmdEvent, index) => `${index + 1}. ${decodeUnicode(cmdEvent.trigger.toString())}`)

  return [
    Structs.text(`${name} v${version} - 命令列表 (第 ${page} 页, 共 ${Math.ceil(commandEvents.length / size)} 页)\n`),
    Structs.text(`Powered by ATRI v${atriVersion}\n`),
    Structs.text(`使用 "${prefix}help -p <页码> -s <每页条数>" 来翻页\n`),
    Structs.text(`使用 "${prefix}help -c <命令>" 查看指定命令的帮助信息\n`),
    Structs.text(commandList.join('\n')),
  ]
}

export const help = plugin.command(/help|帮助/)
  .priority(9999)
  .commander(helpCommander)
  .callback(async ({ context, options, bot, atri }) => {
    const { page, size, command } = options

    const commands = bot.events.command.filter(cmd => cmd.needAdmin ? bot.config.adminId.includes(context.user_id) : true)

    if (command) {
      const msg = await handleFindCommand(commands, command)
      await bot.sendMsg(context, msg)
      return
    }

    const msg = await handleCommandList(commands.filter(cmd => !cmd.hideInHelp), page, size, bot.config.prefix[0], atri.name, atri.version, atri.atriVersion)
    await bot.sendMsg(context, msg)
  })
