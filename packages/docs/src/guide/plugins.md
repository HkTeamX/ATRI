# 开发插件

如果为单文件, 直接编写即可

如果为文件夹, 需要在 `index.ts` / `index.js` 文件中导出 `Plugin` 类

还有一些高级用法, 可以查阅 `ts` 的类型文件

更多示例可以参考 [example](https://github.com/HkTeamX/ATRI/tree/main/packages/example)

```ts
import { BasePlugin } from '@huan_kong/atri'
import { Command } from 'commander'
import { convertCQCodeToJSON, type SendMessageSegment } from 'node-napcat-ts'

export interface PingConfig {
  default_reply: string
}

//           ↓ 类名固定为 Plugin        ↓ 传入配置文件的类型
export class Plugin extends BasePlugin<PingConfig> {
  // ↓ 需要唯一
  name = 'ping'
  version = '1.0.0'
  // 和 package.json 使用一样的版本比较
  dependencies = {
    call: '^1.0.0',
  }

  // 默认配置, 会与本地的 json 文件进行同步和补全
  default_config: PingConfig = {
    default_reply: 'pong',
  }

  init() {
    // 类型可以不传, 默认第一个参数为 message 第二个参数为any
    // 如果需要传递,那么
    // 第一个参数为 end_point 请与设定的 end_point 一致, 如果没有就填 message, 会影响 context 的类型
    // 第二个参数为 联合类型 如下方所示
    this.reg_command_event<
      'message',
      {
        params: { reply?: string }
        args: [string | undefined]
      }
    >({
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
  }
}
```
