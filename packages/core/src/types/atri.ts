import type { LogLevel } from '@huan_kong/logger'
import type { BotConfig } from './bot.js'
import type { BasePlugin } from './plugin.js'

export type ATRIConfig = {
  bot: BotConfig
  debug?: boolean
  baseDir: string
  configDir?: string
  logLevel?: LogLevel
  plugins?: string[]
  timezone?: string

  disableClearTerminal?: boolean
  disableStartupMessage?: boolean
}

export interface PluginModule {
  Plugin?: new (...args: ConstructorParameters<typeof BasePlugin>) => BasePlugin
}

export interface LoadPluginHookContext {
  plugin: BasePlugin
  packageName: string
}

export type LoadPluginHook = (context: LoadPluginHookContext) => Promise<boolean> | boolean

export interface LoadPluginOptions {
  initPlugin?: boolean
  quiet?: boolean
}
