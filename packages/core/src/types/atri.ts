import type { LogLevel } from '@huan_kong/logger'
import type { BotConfig } from './bot.js'
import type { BasePlugin } from './plugin.js'

export type ATRIConfig = {
  bot: BotConfig
  debug?: boolean
  baseDir: string
  configDir?: string
  logLevel?: LogLevel

  disableClearTerminal?: boolean
  disableStartupMessage?: boolean
  disableAutoLoadPlugins?: boolean
}

export interface PluginModule {
  Plugin?: new (...args: ConstructorParameters<typeof BasePlugin>) => BasePlugin
}

export type LoadPluginHook = (plugin: BasePlugin) => Promise<boolean> | boolean

export type ImportFunction = () => Promise<PluginModule>
