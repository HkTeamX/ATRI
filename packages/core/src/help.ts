import { Command } from 'commander'
import { Structs } from 'node-napcat-ts'
import { BasePlugin } from './plugin.js'
import type { CommandCallback } from './reg_event.js'
import { get_command_info } from './utils.js'

export class Plugin extends BasePlugin {
  name = 'help'
  version = '1.0.0'
  auto_load_config = false

  init() {
    this.reg_command_event<{ args: [string | undefined] }>({
      command_name: 'help',
      commander: new Command()
        .description('显示帮助信息')
        .argument('[action]', '显示指定命令的帮助文档'),
      callback: this.handle_help_command.bind(this),
    })
  }

  private async handle_help_command({
    context,
    args,
  }: CommandCallback<{ args: [string | undefined] }>) {
    const [action] = args

    if (!action) {
      const command_list = await this.get_command_list()
      await this.bot.send_msg(context, [
        Structs.text('可用命令列表:\n'),
        Structs.text(`${this.bot.config.prefix[0]}help [命令名] 查询详细用法\n`),
        Structs.text(command_list.map((cmd) => `- ${cmd.name}: ${cmd.description}`).join('\n')),
      ])
      return
    }

    const command = this.bot.get_command_help_information(action)
    if (!command) {
      await this.bot.send_msg(context, [Structs.text('未找到该命令的帮助信息')])
      return
    }

    await this.bot.send_msg(context, [Structs.text(command)])
  }

  async get_command_list() {
    return this.bot.events.command
      .filter((cmd) => cmd.need_hide !== true)
      .map((cmd) => ({
        name: get_command_info(cmd.commander ?? new Command(), cmd.command_name.toString()),
        description: get_command_info(cmd.commander ?? new Command(), '无描述', 'description'),
      }))
  }
}
