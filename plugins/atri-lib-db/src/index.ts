import type { DrizzleConfig } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'

let _connectString: string | null = null

export function setConnectString(connectString: string) {
  const normalized = connectString.trim()

  if (!normalized) {
    throw new Error('数据库连接字符串不能为空')
  }

  _connectString = normalized
}

export function getConnectString() {
  return _connectString
}

export function createDrizzleWithSchema<
  TSchema extends NonNullable<DrizzleConfig['schema']>,
  TConfig extends Omit<DrizzleConfig, 'schema'> = Omit<DrizzleConfig, 'schema'>,
>(
  schema: TSchema,
  config?: TConfig,
): ReturnType<typeof drizzle<TConfig & { schema: TSchema }>> {
  if (!_connectString) {
    throw new Error('请先通过 setConnectionString 后再初始化')
  }

  const mergedConfig = {
    ...config,
    schema,
  } as TConfig & { schema: TSchema }

  return drizzle(_connectString, mergedConfig)
}
