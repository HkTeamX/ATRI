import type { Command } from 'commander'

/**
 * 非空数组
 */
export type NonEmptyArray<T> = [T, ...T[]]

/**
 * 移除对象中的某个字段
 */
export type RemoveField<T, KToRemove extends keyof T> = {
  [K in keyof T as K extends KToRemove ? never : K]: T[K]
}

/**
 * 如果T是never或者undefined，则返回D，否则返回T
 */
export type WithDefault<T, D> = [T] extends [never] ? D : T extends undefined ? D : T

/**
 * 获取时间
 */
export const get_date_time = (split = '/', split2 = ':') => formatDate(new Date(), split, split2)

/**
 * 格式化日期
 */
export function formatDate(date: Date, split = '/', split2 = ':') {
  const y = date.getFullYear()
  const m = date.getMonth() + 1 // 月份从 0 开始
  const d = date.getDate()
  const hh = date.getHours()
  const mm = date.getMinutes()
  const ss = date.getSeconds()

  return [[y, m, d].join(split), [hh, mm, ss].join(split2)].join(' ')
}

/**
 * 排序对象数组
 * @param arr 对象数组
 * @param property 属性名
 * @param sortType up=>升序 down=>降序
 */
export function sort_object_array<T extends object>(
  arr: T[],
  property: keyof T,
  sortType: 'up' | 'down' = 'up',
): T[] {
  return arr.sort((a, b) => {
    if (a[property] > b[property]) return sortType === 'up' ? 1 : -1
    if (a[property] < b[property]) return sortType === 'up' ? -1 : 1
    return 0
  })
}

/**
 * 判断一个值是否为对象
 * @param value
 * @returns
 */
export function is_object(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 同时循环两个数组
 */
export function* zip<T, U>(iter1: T[], iter2: U[]): Generator<[number, T, U]> {
  const len = Math.max(iter1.length, iter2.length)
  for (let i = 0; i < len; i++) {
    yield [i, iter1[i], iter2[i]]
  }
}

/**
 * 获取命令信息
 * @param command Command实例
 * @param fallback 默认值
 * @param field 读取字段 name|description
 */
export function get_command_info(
  command: Command,
  fallback: string,
  field: 'name' | 'description' = 'name',
) {
  const command_info = command[field]().replace('/', '')
  return command_info === '' || command_info === 'program' ? fallback : command_info
}

/**
 * 性能计时器
 * 返回一个获取当前时间耗时的函数
 */
export function performance_counter() {
  const start_time = performance.now()
  return () => {
    const end_time = performance.now()
    return (end_time - start_time).toFixed(2)
  }
}
