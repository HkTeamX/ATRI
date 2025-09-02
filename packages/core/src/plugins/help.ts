import { Command } from 'commander'
import { Structs } from 'node-napcat-ts'
import { BasePlugin } from '../plugin.js'
import type { CommandCallback } from '../reg_event.js'
import { get_command_info } from '../utils.js'

export interface HelpCommandContext {
  args: [string | undefined]
}

export class Plugin extends BasePlugin {
  name = 'help'
  version = '1.0.0'
  auto_load_config = false

  init() {
    this.reg_command_event({
      command_name: 'help',
      commander: new Command()
        .description('显示帮助信息')
        .argument('[action]', '显示指定命令的帮助文档'),
      callback: this.handle_help_command.bind(this),
    })
  }

  private async handle_help_command({ context, args }: CommandCallback<HelpCommandContext>) {
    const [target_command] = args

    if (!target_command) {
      const command_list = await this.get_command_list()
      await this.bot.send_msg(context, [
        Structs.text('可用命令列表:\n'),
        Structs.text(`${this.bot.config.prefix[0]}help [命令名] 查询详细用法\n`),
        Structs.text(command_list.map((cmd) => `- ${cmd.name}: ${cmd.description}`).join('\n')),
      ])
      return
    }

    const help_info = this.bot.get_command_help_information(target_command)
    if (!help_info) {
      await this.bot.send_msg(context, [Structs.text('未找到该命令的帮助信息')])
      return
    }

    await this.bot.send_msg(context, [Structs.text(help_info)])
  }

  async get_command_list() {
    return this.bot.events.command
      .filter((cmd_event) => cmd_event.need_hide !== true)
      .map((cmd_event) => ({
        name: get_command_info(
          cmd_event.commander ?? new Command(),
          cmd_event.command_name.toString(),
        ),
        description: get_command_info(
          cmd_event.commander ?? new Command(),
          '无描述',
          'description',
        ),
      }))
  }
}
