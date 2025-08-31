import { BasePlugin } from '@huan_kong/atri'
import { Command } from 'commander'
import { Structs, type WSSendParam } from 'node-napcat-ts'

export class Plugin extends BasePlugin {
  name = 'call'
  version = '1.0.0'
  auto_load_config = false

  init() {
    this.reg_command_event<'message', { args: [string, string] }>({
      command_name: 'call',
      commander: new Command()
        .description('调用NapCat接口')
        .argument('<action>', '要调用的接口')
        .argument('[params]', '要调用的接口参数', '{}'),
      need_admin: true,
      callback: async ({ context, args }) => {
        const [action, params_text] = args

        if (!(action in this.bot.ws)) {
          this.bot.send_msg(context, [Structs.text(`未找到接口: ${action}`)])
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let params: any
        try {
          params = JSON.parse(params_text)
        } catch (_error) {
          await this.bot.send_msg(context, [Structs.text('请检查传入的参数是否为有效的JSON')])
          return
        }

        try {
          const response = await this.bot.ws[action as keyof WSSendParam](params)
          const result = await this.bot.send_msg(context, [
            Structs.text(`接口调用成功: \n${JSON.stringify(response, null, '\t')}`),
          ])
          if (!result) {
            await this.bot.send_msg(context, [
              Structs.text('接口调用成功, 但是消息发送失败，可能是消息过长或其他原因'),
            ])
          }
        } catch (error) {
          await this.bot.send_msg(context, [
            Structs.text(`接口调用失败: \n${JSON.stringify(error, null, '\t')}`),
          ])
        }
      },
    })
  }
}
