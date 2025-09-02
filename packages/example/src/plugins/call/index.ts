import { BasePlugin } from '@huan_kong/atri'
import { Command } from 'commander'
import { Structs, type WSSendParam } from 'node-napcat-ts'

export class Plugin extends BasePlugin {
  name = 'call'
  version = '1.0.0'
  auto_load_config = false

  init() {
    this.reg_command_event<{ args: [string, string] }>({
      command_name: 'call',
      commander: new Command()
        .description('调用NapCat接口')
        .argument('<action>', '要调用的接口')
        .argument('[params]', '要调用的接口参数', '{}'),
      need_admin: true,
      callback: async ({ context, args }) => {
        const [api_action, params_text] = args

        if (!(api_action in this.bot.ws)) {
          this.bot.send_msg(context, [Structs.text(`未找到接口: ${api_action}`)])
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let api_params: any
        try {
          api_params = JSON.parse(params_text)
        } catch (_parse_error) {
          await this.bot.send_msg(context, [Structs.text('请检查传入的参数是否为有效的JSON')])
          return
        }

        try {
          const api_response = await this.bot.ws[api_action as keyof WSSendParam](api_params)
          const send_result = await this.bot.send_msg(context, [
            Structs.text(`接口调用成功: \n${JSON.stringify(api_response, null, '\t')}`),
          ])
          if (!send_result) {
            await this.bot.send_msg(context, [
              Structs.text('接口调用成功, 但是消息发送失败，可能是消息过长或其他原因'),
            ])
          }
        } catch (api_error) {
          await this.bot.send_msg(context, [
            Structs.text(`接口调用失败: \n${JSON.stringify(api_error, null, '\t')}`),
          ])
        }
      },
    })
  }
}
