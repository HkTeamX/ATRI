import type { LogLevel } from '@huan_kong/logger'
import type { PuppeteerLifeCycleEvent, Viewport } from 'puppeteer'

export type RenderOptions<T extends object = Record<string, unknown>> = (
  | { templatePath: string, data?: T }
  | { html: string, data?: T }
  | { url: string }
) & {
  element?: string
  viewport?: Viewport
  waitUtil?: PuppeteerLifeCycleEvent
}

export interface PuppeteerConfig {
  debug?: boolean
  logLevel?: LogLevel
  viewport?: Viewport
  waitUtil?: PuppeteerLifeCycleEvent
}
