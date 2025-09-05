import type { LogLevel } from '@huan_kong/logger'
import type { NCWebsocketOptions } from 'node-napcat-ts'
import type {
  CommandEvent,
  MessageEvent,
  NoticeEvent,
  OptionArgs,
  OptionParams,
  RequestEvent,
} from './plugin.js'
import type { NonEmptyArray, RemoveField } from './utils.js'

export type BotConfig = {
  debug?: boolean
  logLevel?: LogLevel
  prefix: NonEmptyArray<string>
  adminId: NonEmptyArray<number>
  connection: RemoveField<NCWebsocketOptions, 'reconnection'>
  reconnection: NCWebsocketOptions['reconnection']
}

export type UnRegHandler = () => void

export interface BotEvents {
  command: CommandEvent[]
  message: MessageEvent[]
  notice: NoticeEvent[]
  request: RequestEvent[]
}

export interface CommandData {
  prefix: string
  commandName: string
  params: OptionParams
  args: OptionArgs
}
