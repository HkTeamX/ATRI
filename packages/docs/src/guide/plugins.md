# 开发插件

更多示例可以参考

[ATRI-Official-Plugins](https://github.com/HkTeamX/ATRI-Official-Plugins)

[Minato-Official-Plugins](https://github.com/HkTeamX/Minato-Official-Plugins)

```ts
import { BasePlugin, type CommandCallback } from '@atri-bot/core'
import { Command } from 'commander'
import { convertCQCodeToJSON, type SendMessageSegment } from 'node-napcat-ts'

export interface PingConfig {
  defaultReply: string
}

export interface PingCommandContext {
  args: [string?]
  params: { reply?: string }
}

//           ↓ 类名固定为 Plugin        ↓ 传入配置文件的类型
export class Plugin extends BasePlugin<PingConfig> {
  // 默认配置, 会与本地的 json 文件进行同步和补全
  defaultConfig: PingConfig = {
    defaultReply: 'pong',
  }

  // 请不要在构造函数中编写逻辑, 防止意外重复触发!!!
  // constructor() {} <- 没错就是我

  // 初始化函数, 我说的构造函数不是这个!
  load() {
    // 第一个参数为 定义 callback 中收到的数据
    this.reg_command_event<PingCommandContext>({
      end_point: 'message.private',
      command_name: 'ping',
      commander: new Command()
        .description('检查Bot是否在线, 并返回指定内容')
        .option('-r, --reply <content>', '要回复的内容')
        .argument('[content]', '要回复的内容'),
      callback: async ({ context, params, args }) => {
        await this.bot.send_msg(
          context,
          convertCQCodeToJSON(
            params.reply ?? args[0] ?? this.config.default_reply,
          ) as SendMessageSegment[],
        )
      },
    })

    // callback 也可以使用类中定义的函数
    //                    ↓ 这里想要也可以传入收到的数据类型, 不过一般可以省略, 默认为 any
    this.reg_command_event({
      end_point: 'message.private',
      command_name: 'ping2',
      commander: new Command()
        .description('检查Bot是否在线, 并返回指定内容')
        .option('-r, --reply <content>', '要回复的内容')
        .argument('[content]', '要回复的内容'),
      callback: this.handlePingCommand.bind(this),
      // 根据自己喜好来
      // callback: (options) => this.handlePingCommand(options),
    })
  }

  unload() {}

  /**
   * 处理 ping 命令
   */
  private async handlePingCommand({
    context,
    params,
    args,
    // ↓ 当然也不止这一个 Message Notice 等也都有
  }: CommandCallback<PingCommandContext, 'message.private'>) {
    await this.bot.send_msg(
      context,
      convertCQCodeToJSON(
        params.reply ?? args[0] ?? this.config.default_reply,
      ) as SendMessageSegment[],
    )
  }
}
```
