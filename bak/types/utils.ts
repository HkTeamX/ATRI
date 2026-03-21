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
