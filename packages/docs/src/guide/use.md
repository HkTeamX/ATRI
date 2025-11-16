# 使用

## 1.安装 NapcatQQ

详见 [NapCatQQ文档](https://napneko.github.io/guide/start-install)

## 2.安装 ATRI

全部推荐使用 `pnpm`, 不过大部分市面上的包管理工具理论上都支持

::: code-group

```sh [pnpm]
pnpm add @atri-bot/core
```

:::

## 3.配置 ATRI

按照 `NapCatQQ` 文档创建一个 `正向连接/服务端` 模式的连接

## 4.安装 ATRI 基础插件

此为插件管理插件, 可用于自启时自动加载指定插件, 安装, 禁用 插件等操作

::: code-group

```sh [pnpm]
pnpm add @atri-bot/plugin-plugin-store
```

:::

## 5.连接 NapCatQQ

```ts
import { ATRI, type BotConfig } from '@atri-bot/core'
import type { NCWebsocketOptionsHost } from 'node-napcat-ts'
import path from 'node:path'

const bot: BotConfig = {
  // 命令前缀
  prefix: ['/'],
  // 管理员ID
  adminId: [10001],
  // NapCatQQ 后端配置
  connection: {
    protocol: 'ws',
    host: '127.0.0.1',
    port: 3001,
    accessToken: '',
  },
  // 自动重连配置
  reconnection: {
    enable: true,
    attempts: 10,
    delay: 5000,
  },
}

// 进行初始化
await ATRI.init({
  bot,
  // 是否开启调试模式
  debug: true,
  // 必填参数, 用于配置 node_modules 的加载路径, 一般直接按照下方的直接使用即可
  baseDir: import.meta.dirname,
  // 初始化时自动加载的插件
  // 我们加载上前面说的插件管理插件
  plugins: ['@atri-bot/plugin-plugin-store'],
})
```

## 6.安装剩余基础插件

向机器人发送 `/插件管理 安装 @atri-bot/plugin-help` 来安装帮助指令的插件

后续参数需求等, 请使用 `/help` 命令等查询

如使用 `/help` 命令出现无反应, 请检查控制台输出

大概率时因为 `pupoteer` 没有找到可用的 `chrome`, 根据控制台提示执行命令 `pnpx puppeteer browsers install chrome` 手动安装即可
