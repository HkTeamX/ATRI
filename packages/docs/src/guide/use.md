# 使用

## 使用 init 函数初始化

::: tip
推荐使用此方式
:::

```ts
// 导入 ATRI 类
import { ATRI } from '@huan_kong/atri'

// 使用 init 函数初始化
const atri = await ATRI.init({
  base_dir: import.meta.dirname,
  debug: true,
  bot: {
    // ↓ 可独立设置, 如不设置跟随 atri 中的 debug
    debug: false,
    prefix: ['/'],
    admin_id: [10001],
    connection: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 3001,
      accessToken: '',
    },
    reconnection: {
      enable: true,
      attempts: 10,
      delay: 5000,
    },
  },
})

// 加载插件
await atri.load_plugin('./plugins/ping')

// 检查缺少依赖的插件
atri.check_waiting_plugins()
```

## 手动实例化传入

::: warning
除非有特殊需求, 需要高度自定义, 否则推荐使用 init 函数初始化
:::

```ts
import { ATRI, Bot, type ATRIConfig } from '@huan_kong/atri'
import { NCWebsocket } from 'node-napcat-ts'

const config: ATRIConfig = {
  base_dir: import.meta.dirname,
  debug: true,
  bot: {
    // ↓ 可独立设置, 如不设置跟随 atri 中的 debug
    debug: false,
    prefix: ['/'],
    admin_id: [10001],
    connection: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 3001,
      accessToken: '',
    },
    reconnection: {
      enable: true,
      attempts: 10,
      delay: 5000,
    },
  },
}

const ws = new NCWebsocket(
  {
    ...config.bot.connection,
    reconnection: config.bot.reconnection,
  },
  config.bot.debug,
)
// 推荐在ws连接成功后再实例化, 此处省略
// 请查看 https://node-napcat-ts.huankong.top/guide/how-to-use
// 实例化 Bot 不会自动进行连接操作, 我们的连接初始化操作在 init 中完成
// 所以请自行完成这部分逻辑 示例: https://github.com/HkTeamX/ATRI/blob/main/packages/core/src/bot.ts#L172-L219
const bot = new Bot(config.bot, ws)
const atri = new ATRI(config, bot)
```
