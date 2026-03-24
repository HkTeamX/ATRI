import type { CommandContext } from '@atri-bot/core'
import { decodeUnicode, definePlugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import PackageJson from '../package.json' with { type: 'json' }

const helpCommander = yargs()
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
  .option('command', {
    alias: 'c',
    type: 'string',
    description: '显示指定命令的帮助文档',
  })
const helpRegexp = /ppp|帮助/

export const HelpPlugin = definePlugin(() => {
  return {
    pluginName: PackageJson.name,
    install() {
      this.regCommandEvent({
        trigger: helpRegexp,
        commander: helpCommander,
        callback: this.handleHelpCommand.bind(this),
      })
    },
    uninstall() {},

    async handleHelpCommand({ context, options }: CommandContext<'message', typeof helpCommander>) {
      const { page, size, command } = options

      if (command) {
        const matchedCommand = this.bot.events.command.find((cmd) => {
          if (typeof cmd.trigger === 'string') {
            return cmd.trigger.startsWith(command)
          }
          else {
            return cmd.trigger.test(command)
          }
        })

        if (!matchedCommand || !matchedCommand.commander) {
          await this.bot.sendMsg(context, [Structs.text('未找到该命令的帮助信息')])
          return
        }

        const description = await matchedCommand.commander().getHelp()
        await this.bot.sendMsg(context, [Structs.text(description)])
        return
      }

      const commandList = this.bot.events.command
        .filter(cmd => !cmd.hideInHelp)
        .slice((page - 1) * size, page * size)
        .map((cmdEvent, index) => `${index + 1}. ${decodeUnicode(cmdEvent.trigger.toString())}`)

      await this.bot.sendMsg(context, [
        Structs.text(`ATRI Bot v${this.atri.version} - 命令列表 (第 ${page} 页)\n`),
        Structs.text(`使用 "${this.bot.config.prefix[0]}help -p <页码> -s <每页条数>" 来翻页\n`),
        Structs.text(`使用 "${this.bot.config.prefix[0]}help -c <命令>" 查看指定命令的帮助信息\n`),
        Structs.text(commandList.join('\n')),
      ])
    },
  }
})
