# 开发插件

## 1.定义插件

``` ts
import { Plugin } from '@atri-bot/core'

// 定义一个插件
// 一个插件必须导出 plugin 变量
export const plugin = new Plugin('插件名')
```

## 2.注册事件

具体事件名可以参考 [node-napcat-ts](https://node-napcat-ts.huankong.top/guide/bind-event#%E4%BA%8B%E4%BB%B6%E5%90%8D%E5%A4%A7%E5%85%A8)

``` ts
export const plugin = new Plugin('插件名')
  .onInstall(() => {
    // 可以编写部分逻辑
  })
  .onUninstall(() => {
    // 卸载时触发
  })

// 事件简单分为四大类, 具体每个端点可以通过endPoint选项来配置
// 更多参数配置均为链式调用

export const command = plugin
  // 创建一个command
  .command('trigger')

export const message = plugin.message('可选trigger')
export const notice = plugin.notice()
export const request = plugin.request()
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

## 3.管理插件配置

使用 `setDefaultConfig` 来设置插件的默认配置文件, 如果本地的 `configDir` 下有对应插件的配置文件, 他就会自动去读取, 如果没有那就会使用 `defaultConfig` 去创建, 如果两个配置文件有重叠, 优先本地配置文件

``` ts
const config = {
  ...defaultConfig,
  ...localConfig
}
```

``` ts
interface Config {
  reply: string
}

const plugin = new Plugin<Config>('bot')
  .setDefaultConfig([{
    key: 'reply',
    val: 'pong',
    comment: '添加注释',
    place: 'top' // 注释位置
  }])
  .onInstall(() => {
    console.log(plugin.config)
  })
```

## 5.Bot 工具方法

`bot` 提供了常用的消息与用户工具，方便在插件内直接调用：

::: tip
`bot` 在使用 `callback` 注册的时候从上下文提取

``` ts
const plugin = new Plugin('bot')

export const command = plugin
  // 创建一个command
  .command('trigger')
  .callback(({ bot }) => {
    console.log(bot)
  })
```

:::

```ts
bot.sendMsg(context, [Structs.text('Hello, ATRI!')], { reply: false, at: false })

await bot.sendForwardMsg(
  { message_type: 'group', group_id: context.group_id },
  [Structs.node(context.user_id, '日志', '多条消息...')],
)

const friend = await bot.isFriend({ user_id: context.user_id })
const nickname = await bot.getUsername({ user_id: context.user_id, group_id: context.group_id })
```

- `sendMsg` 默认会自动引用并 @ 触发者，可通过第三个参数关闭。
- `sendForwardMsg` 用于发送合并转发，传入 `Structs.node` 数组即可。
- `isFriend` 与 `getUsername` 帮助快速访问 NapCat 的基础信息，减少重复 API 调用。
- 所有 `reg*Event` 函数都会返回一个卸载函数，若插件需要动态开关某个监听，可以保存后在适当时机调用。

## 6.插件示例

可参考 [ATRI Plugins](https://github.com/HkTeamX/ATRI/tree/main/plugins)
