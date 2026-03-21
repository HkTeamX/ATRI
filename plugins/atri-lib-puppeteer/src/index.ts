import type { Browser } from 'puppeteer'
import type { PuppeteerConfig, RenderOptions } from './types/index.js'
import fs from 'node:fs'
import { Logger, LogLevel } from '@huan_kong/logger'
import ejs from 'ejs'
import puppeteer from 'puppeteer'

let browser: Browser

export class Puppeteer {
  config: PuppeteerConfig
  logger: Logger

  constructor(config: PuppeteerConfig) {
    this.config = config
    this.logger = new Logger({
      title: 'Puppeteer',
      level: config.debug ? LogLevel.DEBUG : LogLevel.INFO,
    })
  }

  async render(options: RenderOptions) {
    options = { ...this.config, ...options }
    if (!browser || !browser.connected)
      browser = await puppeteer.launch()

    const page = await browser.newPage()

    try {
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        ...(options.viewport ?? {}),
      })

      if ('url' in options) {
        await page.goto(options.url)
      }
      else {
        let html: string

        if ('html' in options) {
          html = ejs.render(options.html, options.data)
        }
        else if ('templatePath' in options) {
          if (!fs.existsSync(options.templatePath)) {
            throw new Error(`模板文件不存在: ${options.templatePath}`)
          }

          await page.goto(
            `file://${options.templatePath.startsWith('/') ? '' : '/'}${options.templatePath}`,
          )

          const templateContent = fs.readFileSync(options.templatePath, 'utf-8')
          html = ejs.render(templateContent, options.data)
        }
        else {
          throw new Error('必须提供 html 或 templatePath 参数')
        }

        this.logger.DEBUG('模板处理成功, html:', html)

        // 设置页面内容
        await page.setContent(html, { waitUntil: options.waitUtil })
      }

      const element = await page.$(options.element || 'html')

      const base64 = await (element ?? page).screenshot({
        type: 'png',
        fullPage: element === null,
        encoding: 'base64',
      })

      return `base64://${base64}`
    }
    finally {
      await page.close()
    }
  }
}
