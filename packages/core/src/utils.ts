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
 * 获取时间
 */
export const get_date_time = (split = '/', split2 = ':') => format_date(new Date(), split, split2)

/**
 * 格式化日期
 */
export function format_date(date: Date, split = '/', split2 = ':') {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 月份从 0 开始
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()

  return [[year, month, day].join(split), [hours, minutes, seconds].join(split2)].join(' ')
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
  sort_type: 'up' | 'down' = 'up',
): T[] {
  return arr.sort((first, second) => {
    if (first[property] > second[property]) return sort_type === 'up' ? 1 : -1
    if (first[property] < second[property]) return sort_type === 'up' ? -1 : 1
    return 0
  })
}

/**
 * 判断一个值是否为对象
 * @param value
 * @returns
 */
export function is_object(value: unknown, allow_array = false): value is object {
  return value !== null && typeof value === 'object' && (!Array.isArray(value) || allow_array)
}

/**
 * 同时循环两个数组
 */
export function* zip<T, U>(iter1: T[], iter2: U[]): Generator<[number, T, U]> {
  const max_length = Math.max(iter1.length, iter2.length)
  for (let i = 0; i < max_length; i++) {
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
