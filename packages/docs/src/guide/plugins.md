# 开发插件

## 1.定义插件

``` ts
import { definePlugin } from '@atri-bot/core'

// 定义一个插件
export const plugin = definePlugin({
  pluginName: '测试插件',
  install() {},
  uninstall() {}
})

// 定义一个函数式插件
export const plugin2 = definePlugin(() => {
  return {
    pluginName: '测试插件',
    install() {},
    uninstall() {}
  }
})
```

## 2.注册事件

具体事件名可以参考 [node-napcat-ts](https://node-napcat-ts.huankong.top/guide/bind-event#%E4%BA%8B%E4%BB%B6%E5%90%8D%E5%A4%A7%E5%85%A8)

``` ts
export const plugin = definePlugin({
  pluginName: '测试插件',
  install() {
    // 简单分为四大类, 具体每个端点可以通过endPoint选项来配置
    this.regCommandEvent({})
    this.regMessageEvent({})
    this.regNoticeEvent({})
    this.regRequestEvent({})
  },
  uninstall() {}
})
```

其中每个具体函数的类型:

``` ts
interface CommandContext<T extends keyof MessageHandler, K extends Argv> {
  context: MessageHandler[T]
  options: ReturnType<K['parseSync']>
}
interface CommandEvent<T extends keyof MessageHandler = keyof MessageHandler, K extends Argv = Argv> {
  // 事件类型, 通过函数注册自动传入
  type: 'command'
  // 端点
  endPoint?: T
  // 触发器
  trigger: string | RegExp
  // 优先级
  priority?: number
  // 需要被回复
  needReply?: boolean
  // 需要是管理员
  needAdmin?: boolean
  // 在帮助插件中隐藏
  hideInHelp?: boolean
  // 插件名, 通过函数注册自动传入
  pluginName: string
  // 命令解析器
  commander?: () => K
  // 回调函数
  callback: (context: CommandContext<T, K>) => MaybePromise<void | 'quit'>
}

interface MessageContext<T extends keyof MessageHandler> {
  context: MessageHandler[T]
}
interface MessageEvent<T extends keyof MessageHandler = keyof MessageHandler> {
  type: 'message'
  endPoint?: T
  trigger?: string | RegExp
  priority?: number
  needReply?: boolean
  needAdmin?: boolean
  pluginName: string
  callback: (context: MessageContext<T>) => MaybePromise<void | 'quit'>
}

interface NoticeContext<T extends keyof NoticeHandler> {
  context: NoticeHandler[T]
}
interface NoticeEvent<T extends keyof NoticeHandler = keyof NoticeHandler> {
  type: 'notice'
  endPoint?: T
  priority?: number
  pluginName: string
  callback: (context: NoticeContext<T>) => MaybePromise<void | 'quit'>
}

interface RequestContext<T extends keyof RequestHandler> {
  context: RequestHandler[T]
}
interface RequestEvent<T extends keyof RequestHandler = keyof RequestHandler> {
  type: 'request'
  endPoint?: T
  priority?: number
  pluginName: string
  callback: (context: RequestContext<T>) => MaybePromise<void | 'quit'>
}
```

## 3.插件运行时上下文

`definePlugin` 会在插件实例化时把若干运行时字段挂到 `this` 上，方便在 `install`/`uninstall` 阶段直接调用。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `atri` | `ATRI` | 框架实例，可主动安装/卸载其他插件。 |
| `bot` | `ATRI['bot']` | 底层 `Bot` 对象，封装了事件注册与消息 API。 |
| `ws` | `ATRI['bot']['ws']` | NapCat WebSocket 客户端，若需要直接发起原始 API，可使用此字段。 |
| `config` | `TConfig` | 合并后的插件配置，默认读取/写入 `configDir/<pluginName>.json`。 |
| `logger` | `Logger` | 已经带上插件名的日志实例。 |
| `refreshConfig()` | `Promise<void>` | 重新从磁盘加载配置，热修改配置文件时使用。 |
| `saveConfig(config?: TConfig)` | `Promise<void>` | 写回配置，若不传参则保存当前 `this.config`。 |

这些字段同样可以借助 TypeScript 的类型推断获得自动补全，建议为插件定义独立的 Props/Config 接口，提升可维护性。

## 4.管理插件配置

当需要持久化用户配置时，提供 `defaultConfig` 即可让 ATRI 自动处理读写逻辑：
如果配置文件在插件中动态被修改了, 那么只是在内存中, 如果需要保存到硬盘, 就需要手动调用 `saveConfig`

```ts
interface CounterConfig {
  maxTimes: number
}

export const CounterPlugin = definePlugin<{ times: number }, CounterConfig>({
  pluginName: 'counter',
  defaultConfig: {
    maxTimes: 3,
  },
  times: 0,
  async install() {
    this.logger.INFO(`当前配置: ${JSON.stringify(this.config)}`)

    // 更新内存状态
    this.times += 1

    if (this.times > this.config.maxTimes) {
      this.config.maxTimes = this.times
      await this.saveConfig()
    }
  },
  uninstall() {},
})
```

- `defaultConfig` 会与磁盘上的 JSON 合并，未提供的字段回落到默认值。
- 若显式传入 `config`，ATRI 将不会自动读写磁盘，适合在测试环境中注入临时配置。
- 通过 `this.refreshConfig()` 可以在不重启的情况下重新加载用户手动修改的配置。

## 5.Bot 工具方法

`this.bot` 提供了常用的消息与用户工具，方便在插件内直接调用：

```ts
this.bot.sendMsg(context, [Structs.text('Hello, ATRI!')], { reply: false, at: false })

await this.bot.sendForwardMsg(
  { message_type: 'group', group_id: context.group_id },
  [Structs.node(context.user_id, '日志', '多条消息...')],
)

const friend = await this.bot.isFriend({ user_id: context.user_id })
const nickname = await this.bot.getUsername({ user_id: context.user_id, group_id: context.group_id })
```

- `sendMsg` 默认会自动引用并 @ 触发者，可通过第三个参数关闭。
- `sendForwardMsg` 用于发送合并转发，传入 `Structs.node` 数组即可。
- `isFriend` 与 `getUsername` 帮助快速访问 NapCat 的基础信息，减少重复 API 调用。
- 所有 `reg*Event` 函数都会返回一个卸载函数，若插件需要动态开关某个监听，可以保存后在适当时机调用。

## 6.插件示例

可参考 [ATRI Plugins](https://github.com/HkTeamX/ATRI/tree/main/plugins)

``` ts
import type { CommandContext } from '@atri-bot/core'
import { definePlugin } from '@atri-bot/core'
import { Structs } from 'node-napcat-ts'
import yargs from 'yargs'
import packageJson from '../package.json' with { type: 'json' }

//               ↓ 定义插件上会增加的属性, 可以不加让ts自动推断
export interface PingPluginProps {
  pingCommander: typeof pingCommander
  handlePingCommand: (context: CommandContext<'message', typeof pingCommander>) => Promise<void>
}

//               ↓ 定义插件的配置文件
export interface PingPluginConfig {
  defaultReply: string
}

//              ↓ 定义插件命令解析器
const pingCommander = yargs()
  //     ↓ 标准yargs使用方式, 定义--reply选项
  .option('reply', {
    // -r 缩写
    alias: 'r',
    // 字符串类型
    type: 'string',
    // 介绍
    description: '自定义回复内容',
    // 是否必选
    demandOption: true,
  })

//                                     ↓ 先定义会增加的属性 再定义配置文件
//                                       如果配置了需要增加的属性, 配置文件的类型会变成object, 请注意
export const PingPlugin = definePlugin<PingPluginProps, PingPluginConfig>({
  // 插件名
  pluginName: packageJson.name,
  // 定义默认配置文件
  defaultConfig: {
    defaultReply: 'pong',
  },
  // 插件被加载时运行的函数
  install() {
    // 注册一个命令事件
    this.regCommandEvent({
      // 触发器, 可以为正则表达式
      trigger: 'ping',
      // 命令解析器
      commander: pingCommander,
      // 回调           消息上下文  解析后的命令信息
      callback: async ({ context, options }) => {
        await this.bot.sendMsg(
          context,
          [Structs.text(options.reply ?? this.config.defaultReply)],
          { reply: false, at: false },
        )
      },
    })

    this.regCommandEvent({
      trigger: 'ping2',
      commander: pingCommander,
      // 另外分离的处理函数
      callback: this.handlePingCommand.bind(this),
    })
  },
  // 插件卸载
  uninstall() {},
  pingCommander,

  // 独立处理函数           ↓ 这里可以不定义类型, 因为我们已经在 PingPluginProps 中定义好了类型
  async handlePingCommand({ context, options }) {
    await this.bot.sendMsg(
      context,
      [Structs.text(options.reply ?? this.config.defaultReply)],
      { reply: false, at: false },
    )
  },
})
```
