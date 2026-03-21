import type { CommandCallback } from '@atri-bot/core'
import path from 'node:path'
import { BasePlugin } from '@atri-bot/core'
import { Puppeteer } from '@atri-bot/lib-puppeteer'
import { Command } from 'commander'
import { Structs } from 'node-napcat-ts'

export interface HelpCommandContext {
  args: [string?]
  params: {
    page?: number
    size?: number
  }
}

export class Plugin extends BasePlugin {
  disableAutoLoadConfig = true
  puppeteer = new Puppeteer({
    ...this.atri.config,
    viewport: {
      width: 650,
      height: 800,
    },
  })

  load() {
    this.regCommandEvent({
      commandName: /help|帮助/,
      commander: new Command()
        .description('显示帮助信息')
        .argument('[action]', '显示指定命令的帮助文档')
        .option('-p, --page <number>', '页码', '1')
        .option('-s, --size <number>', '每页条数', '8'),
      callback: this.handleHelpCommand.bind(this),
    })
  }

  unload() {}

  private async handleHelpCommand({ context, args, params }: CommandCallback<HelpCommandContext>) {
    const [targetCommand] = args

    if (!targetCommand) {
      const commandList = await this.getCommandList()
      const { page = 1, size = 8 } = params

      if (size > 8) {
        await this.bot.sendMsg(context, [Structs.text('每页条数最大为8哦~')])
        return
      }

      // 请根据page去分割commandList
      const pagedCommandList = commandList.slice((page - 1) * size, page * size)

      if (pagedCommandList.length === 0) {
        await this.bot.sendMsg(context, [Structs.text('未找到该页的命令列表')])
        return
      }

      const image = await this.puppeteer.render({
        templatePath: path.join(__dirname, 'static', 'command_list.html'),
        data: {
          command_help_info: `发送 "${this.bot.config.prefix[0]}help [命令名]" 查询详细用法, 使用 -p 和 -s 参数可分页查看命令列表`,
          commands: pagedCommandList,
          page,
          size,
          total: commandList.length,
        },
      })

      await this.bot.sendMsg(context, [Structs.image(image)], { reply: false, at: false })
      return
    }

    const helpInfo = this.bot.getCommandHelpInformation(targetCommand)
    if (!helpInfo) {
      await this.bot.sendMsg(context, [Structs.text('未找到该命令的帮助信息')])
      return
    }

    const image = await this.puppeteer.render({
      templatePath: path.join(__dirname, 'static', 'command_args.html'),
      data: {
        command_args: helpInfo,
      },
    })

    await this.bot.sendMsg(context, [Structs.image(image)])
  }

  decodeUnicode(str: string) {
    return str.replace(/\\u([\dA-F]{4})/gi, (_, g1) => String.fromCharCode(Number.parseInt(g1, 16)))
  }

  private async getCommandList() {
    return this.bot.events.command
      .filter(cmdEvent => cmdEvent.needHide !== true)
      .map((cmdEvent, index) => ({
        name: this.decodeUnicode(cmdEvent.commandName.toString()),
        description: this.decodeUnicode(
          this.bot.getCommandInfo(cmdEvent.commander ?? new Command(), '无描述', 'description'),
        ),
        index: index + 1,
      }))
  }
}
