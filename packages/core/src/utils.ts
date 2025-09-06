/**
 * 性能计时器
 * 返回一个获取当前时间耗时的函数
 */
export function performanceCounter() {
  const startTime = performance.now()
  return () => {
    const endTime = performance.now()
    return (endTime - startTime).toFixed(2)
  }
}

/**
 * 排序对象数组
 * @param arr 对象数组
 * @param property 属性名
 * @param sortType up=>升序 down=>降序
 */
export function sortObjectArray<T extends object>(
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
