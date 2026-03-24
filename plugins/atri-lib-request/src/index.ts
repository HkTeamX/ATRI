import type { Input, KyInstance, Options, ResponsePromise } from 'ky'
import fs from 'node:fs'
import path from 'node:path'
import stream from 'node:stream'
import { definePlugin } from '@atri-bot/core'
import ky from 'ky'
import PackageJson from '../package.json'

export interface RequestPluginConfig {
  kyOptions?: Options
}

export interface DownloadFileOptions extends Options {
  filename?: string
  savePath: string
}

export interface RequestPluginProps {
  defaultKyConfig: Options
  ky: KyInstance
  request: <T>(input: Input, options?: Options) => ResponsePromise<T>
  json: <T>(input: Input, options?: Options) => Promise<T>

  extractFilenameFromHeader: (disposition: string) => string | null
  downloadFile: (input: Input, options: DownloadFileOptions) => Promise<string>
}

const extractFilenameRegexp = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i

export function RequestPlugin(options: RequestPluginConfig = {}) {
  return definePlugin<RequestPluginProps>({
    pluginName: PackageJson.name,
    defaultKyConfig: {},
    ky: ky.create(),
    install() {
      this.defaultKyConfig = {
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
        ...this.defaultKyConfig,
        ...options.kyOptions,
      })
    },
    uninstall() {},

    request(input, options?) {
      return this.ky(input, options)
    },
    json(input, options?) {
      return this.request(input, options).json()
    },
    extractFilenameFromHeader(disposition) {
      const match = disposition.match(extractFilenameRegexp)

      if (!match) {
        return null
      }

      return decodeURIComponent(match[1] || match[2])
    },
    async downloadFile(
      input: Input,
      options: DownloadFileOptions,
    ): Promise<string> {
      const response = await this.request(input, options)
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
    },
  })
}
