# 使用

## 1.安装 NapcatQQ

详见 [NapCatQQ文档](https://napneko.github.io/guide/start-install)

## 2.安装 ATRI

全部推荐使用 `bun`, 不过大部分市面上的包管理工具理论上都支持

::: code-group

```sh [bun]
bun add @atri-bot/core
```

:::

## 3.配置 ATRI

按照 `NapCatQQ` 文档创建一个 `正向连接/服务端` 模式的连接

## 4.安装 ATRI 基础插件

此为帮助插件和ping测试插件

::: code-group

```sh [bun]
bun add @atri-bot/plugin-help @atri-bot/plugin-ping @huan_kong/logger node-napcat-ts
```

:::

## 5.连接 NapCatQQ

```ts
import type { NCWebsocketOptionsHost } from 'node-napcat-ts'
import process from 'node:process'
import { ATRI } from '@atri-bot/core'
import { HelpPlugin } from '@atri-bot/plugin-help'
import { PingPlugin } from '@atri-bot/plugin-ping'
import { LogLevel } from '@huan_kong/logger'

const debug = process.argv.includes('--debug')

const atri = new ATRI({
  logLevel: debug ? LogLevel.DEBUG : LogLevel.INFO,
  plugins: [
    PingPlugin,
    HelpPlugin,
  ],
  configDir: './config',
  logDir: './logs',
  saveLogs: !debug,
  botConfig: {
    prefix: JSON.parse(process.env.PREFIX ?? '["/"]'),
    adminId: JSON.parse(process.env.ADMIN_ID ?? '[10001]'),
    protocol: (process.env.NC_PROTOCOL ?? 'ws') as NCWebsocketOptionsHost['protocol'],
    host: process.env.NC_HOST ?? '127.0.0.1',
    port: Number.parseInt(process.env.NC_PORT ?? '3001'),
    accessToken: process.env.NC_ACCESS_TOKEN,
    reconnection: {
      enable: process.env.NC_RECONNECTION_ENABLE === 'true',
      attempts: Number.parseInt(process.env.NC_RECONNECTION_ATTEMPTS ?? '10'),
      delay: Number.parseInt(process.env.NC_RECONNECTION_DELAY ?? '5000'),
    },
  },
})

// 启动初始化流程
atri.init()
```

## 6.测试是否启动成功

请使用 `/help` 命令来查询可用命令列表
