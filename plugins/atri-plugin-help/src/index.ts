import type { ATRI, Bot, CommandEvent } from '@atri-bot/core'
import type { MessageHandler } from 'node-napcat-ts'
import { decodeUnicode, Plugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import PackageJson from '../package.json' with { type: 'json' }

export const plugin = new Plugin(PackageJson.name)

export interface HandleFindCommandOptions {
  commandList: CommandEvent[]
  command: string
  isAdmin: boolean
}

export async function handleFindCommand(options: HandleFindCommandOptions) {
  const { commandList, command, isAdmin } = options

  const matchedCommand = commandList
    .filter(cmd => cmd.needAdmin ? isAdmin : true)
    .find(cmd =>
      typeof cmd.trigger === 'string'
        ? cmd.trigger === command
        : cmd.trigger.test(command),
    )

  if (!matchedCommand || !matchedCommand.commander) {
    return '未找到该命令的帮助信息'
  }

  const description = await matchedCommand.commander().getHelp()
  return description
}

export interface HandleCommandListOptions {
  commandList: CommandEvent[]
  isAdmin: boolean
  page: number
  size: number
  prefix: string
  name: string
  version: string
  atriVersion: string
  showHelp?: boolean
}

export async function handleCommandList(options: HandleCommandListOptions) {
  const { commandList, isAdmin, page, size, prefix, name, version, atriVersion, showHelp = true } = options

  const filteredCommandList = commandList
    .filter(cmd => cmd.hideInHelp ? false : (cmd.needAdmin ? isAdmin : true))

  const paginatedCommandList = filteredCommandList
    .slice((page - 1) * size, page * size)
    .map((cmdEvent, index) => `${index + 1}. ${decodeUnicode(cmdEvent.trigger.toString())}`)

  return [
    Structs.text(`${name} v${version} - 命令列表 (第 ${page} 页, 共 ${Math.ceil(filteredCommandList.length / size)} 页)\n`),
    Structs.text(`Powered by ATRI v${atriVersion}\n`),
    ...(
      showHelp
        ? [
            Structs.text(`使用 "${prefix}help -p <页码> -s <每页条数>" 来翻页\n`),
            Structs.text(`使用 "${prefix}help -c <命令>" 查看指定命令的帮助信息\n`),
          ]
        : []
    ),
    Structs.text(paginatedCommandList.join('\n')),
  ]
}

export async function handleInteractiveHelp(context: MessageHandler['message'], bot: Bot, atri: ATRI) {
  await bot.sendMsg(context, [
    Structs.text('请选择要查看帮助的命令(回复序号即可):\n'),
    Structs.text('1. 命令列表\n'),
    Structs.text('2. 查找命令'),
  ])

  let choice: number
  while (true) {
    const response = await bot.useMessage(context)
    if (!response) {
      return
    }

    const inputChoice = Number.parseInt(response.raw_message.trim())
    if (Number.isNaN(inputChoice) || inputChoice < 1 || inputChoice > 2) {
      await bot.sendMsg(context, '无效的选择, 请重新输入~')
      continue
    }

    choice = inputChoice
    break
  }

  const isAdmin = bot.config.adminId.includes(context.user_id)

  if (choice === 2) {
    await bot.sendMsg(context, '请输入要查找的命令:')
    const cmdResponse = await bot.useMessage(context)
    if (!cmdResponse) {
      return
    }

    const msg = await handleFindCommand({
      commandList: bot.events.command,
      command: cmdResponse.raw_message.trim(),
      isAdmin,
    })
    await bot.sendMsg(context, msg)
  }
  else if (choice === 1) {
    let page = 1
    const msg = await handleCommandList({
      commandList: bot.events.command,
      isAdmin,
      page,
      size: 8,
      prefix: bot.config.prefix[0],
      name: atri.name,
      version: atri.version,
      atriVersion: atri.atriVersion,
      showHelp: false,
    })
    await bot.sendMsg(context, msg)

    while (true) {
      await bot.sendMsg(context, '回复 "下一页" 或 "上一页" 来翻页, 回复 "退出" 来结束交互')
      const pageResponse = await bot.useMessage(context)
      if (!pageResponse) {
        return
      }

      const text = pageResponse.raw_message.trim()
      if (text === '退出') {
        await bot.sendMsg(context, '已退出帮助')
        return
      }

      if (text === '下一页') {
        page++
      }
      else if (text === '上一页') {
        page--
      }
      else {
        await bot.sendMsg(context, '无效的输入, 请重新输入~')
        continue
      }

      const msg = await handleCommandList({
        commandList: bot.events.command,
        isAdmin,
        page,
        size: 8,
        prefix: bot.config.prefix[0],
        name: atri.name,
        version: atri.version,
        atriVersion: atri.atriVersion,
        showHelp: false,
      })
      await bot.sendMsg(context, msg)
    }
  }
}

export const help = plugin.command(/help|帮助/)
  .priority(9999)
  .commander(yargs =>
    yargs()
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
      .option('interactive', {
        alias: 'i',
        type: 'boolean',
        description: '启用交互模式',
        default: false,
      }),
  )
  .callback(async ({ context, options, bot, atri }) => {
    const { page, size, command, interactive } = options

    if (interactive) {
      await handleInteractiveHelp(context, bot, atri)
      return
    }

    const isAdmin = bot.config.adminId.includes(context.user_id)

    if (command) {
      const msg = await handleFindCommand({
        commandList: bot.events.command,
        command,
        isAdmin,
      })
      await bot.sendMsg(context, msg)
      return
    }

    const msg = await handleCommandList({
      commandList: bot.events.command,
      isAdmin,
      page,
      size,
      prefix: bot.config.prefix[0],
      ...atri,
    })
    await bot.sendMsg(context, msg)
  })
