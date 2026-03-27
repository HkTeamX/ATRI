import type { ATRI } from '@atri-bot/core'
import type { Input, Options } from 'ky'
import fs from 'node:fs'
import path from 'node:path'
import stream from 'node:stream'
import ky from 'ky'

export interface DownloadFileOptions extends Options {
  filename?: string
  savePath: string
}

export const extractFilenameRegexp = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i

export function extractFilenameFromHeader(disposition: string) {
  const match = disposition.match(extractFilenameRegexp)

  if (!match) {
    return null
  }

  return decodeURIComponent(match[1] || match[2])
}

export function useRequest(atri: ATRI, config?: Options) {
  const logger = atri.logger.clone({
    title: 'RequestLib',
  })

  const defaultKyConfig: Options = {
    hooks: {
      beforeRequest: [
        (request, options) => {
          logger.DEBUG('发送网络请求', { request, options })
        },
      ],
      beforeRetry: [
        ({ request, error, retryCount }) => {
          logger.DEBUG(`收到网络请求失败响应[${retryCount}]`, { request, error })
        },
      ],
      afterResponse: [
        (request, options, response) => {
          logger.DEBUG('收到网络请求成功响应', { request, options, response })
        },
      ],
      beforeError: [
        async (context) => {
          logger.DEBUG('收到网络请求错误响应', context)
          return context
        },
      ],
    },
  }

  const kyInstance = ky.create({
    ...defaultKyConfig,
    ...config,
  })

  return {
    ...kyInstance,
    async downloadFile(
      input: Input,
      options: DownloadFileOptions,
    ): Promise<string> {
      const response = await kyInstance(input, options)
      if (!response.body) {
        throw new Error('响应体为空，无法下载文件')
      }

      let fullPath = options.savePath
      if (!options.filename) {
        const disposition = response.headers.get('Content-Disposition')
        const nameFromUrl = path.basename(new URL(input.toString()).pathname)
        options.filename
          = !disposition
            ? nameFromUrl
            : extractFilenameFromHeader(disposition) ?? nameFromUrl
      }

      fullPath = path.join(fullPath, options.filename)
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })

      if (fs.existsSync(fullPath)) {
        throw new Error(`文件已存在: ${fullPath}`)
      }

      const nodeStream = stream.Readable.fromWeb(response.body)
      const fileStream = fs.createWriteStream(fullPath)
      await stream.promises.pipeline(nodeStream, fileStream)

      return fullPath
    },
  }
}
