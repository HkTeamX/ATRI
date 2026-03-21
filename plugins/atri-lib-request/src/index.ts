import type { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios'
import type { IAxiosRetryConfig } from 'axios-retry'
import type { Readable } from 'node:stream'
import fs from 'node:fs'
import path from 'node:path'
import { Logger, LogLevel } from '@huan_kong/logger'
import _axios from 'axios'
import axiosRetry from 'axios-retry'

export interface AxiosConfig {
  debug?: boolean
  logLevel?: LogLevel
  axiosRetry?: IAxiosRetryConfig
  createAxios?: CreateAxiosDefaults
}

export class Axios {
  axiosInstance: AxiosInstance
  config: AxiosConfig
  logger: Logger

  constructor(config: AxiosConfig) {
    this.config = config
    this.logger = new Logger({
      title: 'Axios',
      level: config.logLevel ?? (config.debug ? LogLevel.DEBUG : undefined),
    })
    this.axiosInstance = _axios.create({
      ...this.config.createAxios,
    })

    axiosRetry(this.axiosInstance, {
      retries: this.config.axiosRetry?.retries ?? 3,
      retryDelay: (...args) => {
        this.logger.DEBUG(
          `收到网络请求失败响应[${args[0]}/${this.config.axiosRetry?.retries ?? 3}]`,
          {
            url: args[1].config?.url,
            method: args[1].config?.method,
            status: args[1].response?.status,
            message: args[1].message,
            response: args[1].response?.data,
          },
        )
        return (this.config.axiosRetry?.retryDelay ?? axiosRetry.linearDelay())(...args)
      },
      ...this.config.axiosRetry,
    })

    if (config.debug) {
      // 添加请求拦截器
      this.axiosInstance.interceptors.request.use(
        (config) => {
          this.logger.DEBUG('发送网络请求', {
            method: config.method,
            url: config.url,
            headers: config.headers,
            params: config.params,
            data: config.data,
          })

          return config
        },
        (error) => {
          this.logger.ERROR('发送网络请求时遇到问题', error)
          return Promise.reject(error)
        },
      )

      // 添加响应拦截器
      this.axiosInstance.interceptors.response.use((response) => {
        this.logger.DEBUG('收到网络请求成功响应', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          response: response.data,
        })
        return response
      })
    }
  }

  request<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.axiosInstance.request<T>(config)
  }

  get<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'GET' })
  }

  delete<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'DELETE' })
  }

  head<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'HEAD' })
  }

  options<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'OPTIONS' })
  }

  post<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'POST' })
  }

  put<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'PUT' })
  }

  patch<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'PATCH' })
  }

  extractFilenameFromHeader(disposition?: string): string | null {
    if (!disposition)
      return null
    const match = disposition.match(/filename="?(.+)"?/)
    return match ? decodeURIComponent(match[1]) : null
  }

  async downloadFile(
    config: AxiosRequestConfig,
    savePath: string,
    filename: string | null = null,
  ): Promise<string> {
    const response = await this.request<Readable>({
      ...config,
      responseType: 'stream',
    })

    let fullPath = savePath
    if (!filename) {
      fullPath = path.join(
        fullPath,
        this.extractFilenameFromHeader(response.headers['content-disposition']) || 'download.bin',
      )
    }
    else {
      fullPath = path.join(fullPath, filename)
    }

    const writer = fs.createWriteStream(fullPath)

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(fullPath))
      writer.on('error', reject)
    })
  }
}
