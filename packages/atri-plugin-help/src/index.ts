import { BasePlugin, type CommandCallback } from '@atri-bot/core'
import { Command } from 'commander'
import { Structs } from 'node-napcat-ts'

export interface HelpCommandContext {
  args: [string?]
}

export class Plugin extends BasePlugin {
  pluginName = 'help'
  disableAutoLoadConfig = false

  load() {
    this.regCommandEvent({
      commandName: /help|帮助/,
      commander: new Command()
        .description('显示帮助信息')
        .argument('[action]', '显示指定命令的帮助文档'),
      callback: this.handle_help_command.bind(this),
    })
  }

  unload() {}

  private async handle_help_command({ context, args }: CommandCallback<HelpCommandContext>) {
    const [target_command] = args

    if (!target_command) {
      const command_list = await this.get_command_list()
      await this.bot.sendMsg(context, [
        Structs.text('可用命令列表:\n'),
        Structs.text(`${this.bot.config.prefix[0]}help [命令名] 查询详细用法\n`),
        Structs.text(command_list.map((cmd) => `- ${cmd.name}: ${cmd.description}`).join('\n')),
      ])
      return
    }

    const help_info = this.bot.getCommandHelpInformation(target_command)
    if (!help_info) {
      await this.bot.sendMsg(context, [Structs.text('未找到该命令的帮助信息')])
      return
    }

    await this.bot.sendMsg(context, [Structs.text(help_info)])
  }

  async get_command_list() {
    return this.bot.events.command
      .filter((cmd_event) => cmd_event.needHide !== true)
      .map((cmd_event) => ({
        name: cmd_event.commandName.toString(),
        description: this.bot.getCommandInfo(
          cmd_event.commander ?? new Command(),
          '无描述',
          'description',
        ),
      }))
  }
}
