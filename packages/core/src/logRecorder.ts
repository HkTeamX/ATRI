import { InjectLogger, LogLevel } from '@huan_kong/logger'
import fs from 'node:fs'
import path from 'node:path'
import type { ATRIConfig } from './types/atri.js'
import type { LogRecorderConfig } from './types/logRecorder.js'

export class LogRecorder extends InjectLogger {
  config: LogRecorderConfig
  atriConfig: ATRIConfig
  originConsoleLog = console.log

  constructor(atriConfig: ATRIConfig, config: LogRecorderConfig) {
    super({ level: atriConfig.logLevel ?? (atriConfig.debug ? LogLevel.DEBUG : undefined) })

    this.atriConfig = atriConfig
    this.config = config

    if (atriConfig.debug && !config.enable) {
      this.logger.WARN('当前处于开发模式, 如需记录日志, 请将 logRecorder.enable 设为 true')
      return
    }

    this.config = {
      ...{
        maxFiles: 31,
        maxSize: 100 * 1024 * 1024,
        logLevel: atriConfig.debug ? LogLevel.DEBUG : LogLevel.INFO,
        logDir: path.join(atriConfig.baseDir, 'logs'),
      },
      ...this.config,
    }

    this.rewriteConsole()
    this.handleException()

    this.logger.INFO('日志记录器已启用')
  }

  rewriteConsole() {
    console.log = ((originFunction) => {
      return (...args) => {
        this.saveLog(args)
        originFunction(...args)
      }
    })(console.log)
  }

  handleException() {
    process.on('uncaughtException', (err) => {
      this.logger.ERROR('捕获到未处理的异常, 错误信息: \n', err)
    })
  }

  stripAnsi(str: string) {
    return str.replace(
      // 匹配所有 ANSI 转义序列
      // eslint-disable-next-line no-control-regex
      /\u001B\[[0-9;]*m/g,
      '',
    )
  }

  saveLog(args: string[]) {
    const strippedArgs = args
      .map((value) => {
        return this.stripAnsi(value)
      })
      .join(' ')

    if (!fs.existsSync(this.config.logDir!)) fs.mkdirSync(this.config.logDir!, { recursive: true })

    const logFilePath = path.join(
      this.config.logDir!,
      `${new Date().toISOString().split('T')[0]}.log`,
    )
    if (!fs.existsSync(logFilePath)) this.removeUselessLogs()

    fs.appendFileSync(logFilePath, strippedArgs + '\n', { encoding: 'utf-8' })
  }

  removeUselessLogs() {
    const files = fs.readdirSync(this.config.logDir!).filter((file) => {
      return (
        /^\d{4}-\d{2}-\d{2}/.test(file) &&
        fs.statSync(path.join(this.config.logDir!, file)).isFile()
      )
    })

    if (files.length <= this.config.maxFiles!) return

    const filesToDeleteCount = files.length - this.config.maxFiles! + 1

    files
      .sort()
      .slice(0, filesToDeleteCount)
      .map((file) => fs.rmSync(path.join(this.config.logDir!, file)))
  }
}
