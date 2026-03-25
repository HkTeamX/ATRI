import type { Logger, LogLevelType } from '@huan_kong/logger'
import type { Input, KyInstance, Options } from 'ky'
import type { ATRI } from './atri.js'
import fs from 'node:fs'
import path from 'node:path'
import stream from 'node:stream'
import ky from 'ky'

export interface RequestConfig extends Options {
  logLevel?: LogLevelType
}

export interface DownloadFileOptions extends Options {
  filename?: string
  savePath: string
}

export const extractFilenameRegexp = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i

export class Request {
  config: RequestConfig
  logger: Logger
  ky: KyInstance

  constructor(atri: ATRI, config: RequestConfig) {
    this.config = config
    this.logger = atri.logger.clone({
      title: 'Request',
      level: config.logLevel,
    })

    const defaultConfig: Options = {
      hooks: {
        beforeRequest: [
          (request, options) => {
            this.logger.DEBUG('发送网络请求', { request, options })
          },
        ],
        beforeRetry: [
          ({ request, error, retryCount }) => {
            this.logger.DEBUG(`收到网络请求失败响应[${retryCount}]`, { request, error })
          },
        ],
        afterResponse: [
          (request, options, response) => {
            this.logger.DEBUG('收到网络请求成功响应', { request, options, response })
          },
        ],
        beforeError: [
          async (context) => {
            this.logger.DEBUG('收到网络请求错误响应', context)
            return context
          },
        ],
      },
    }
    this.ky = ky.create({
      ...defaultConfig,
      ...config,
    })
  }

  json(input: Input, options: Options) {
    return this.ky(input, options).json()
  }

  extractFilenameFromHeader(disposition: string) {
    const match = disposition.match(extractFilenameRegexp)

    if (!match) {
      return null
    }

    return decodeURIComponent(match[1] || match[2])
  }

  async downloadFile(
    input: Input,
    options: DownloadFileOptions,
  ): Promise<string> {
    const response = await this.ky(input, options)
    if (!response.body) {
      throw new Error('响应体为空，无法下载文件')
    }

    let fullPath = options.savePath
    if (!options.filename) {
      const disposition = response.headers.get('Content-Disposition')
      options.filename
        = !disposition
          ? 'download.bin'
          : this.extractFilenameFromHeader(disposition) ?? 'download.bin'
    }

    fullPath = path.join(fullPath, options.filename)
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })

    const nodeStream = stream.Readable.fromWeb(response.body)
    const fileStream = fs.createWriteStream(fullPath)
    await stream.promises.pipeline(nodeStream, fileStream)

    return fullPath
  }
}
