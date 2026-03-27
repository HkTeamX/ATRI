import type { ATRI } from '@atri-bot/core'
import type { AnyRelations, DrizzleConfig, EmptyRelations } from 'drizzle-orm'
import type { MigrationConfig } from 'drizzle-orm/migrator'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import { timestamp } from 'drizzle-orm/pg-core'

export const timestamps = {
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

let initDbPluginOptions: InitDbPluginOptions | null = null

export interface InitDbPluginOptions {
  connectString: string
  config?: DrizzleConfig
}

export async function initDb(atri: ATRI, options: InitDbPluginOptions) {
  const logger = atri.logger.clone({
    title: 'DbPlugin-init',
  })

  try {
    const db = drizzle(options.connectString, options.config ?? {})
    await db.execute(sql`SELECT 1;`)
    initDbPluginOptions = options
    logger.INFO('测试数据库连接成功')
  }
  catch (error) {
    logger.ERROR('测试数据库连接失败', error)
    throw error
  }
}

export interface DbPluginOptions<TSchema extends Record<string, unknown>, TRelations extends AnyRelations> {
  config: DrizzleConfig<TSchema, TRelations>
  migration?: MigrationConfig
}

export async function useDb<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(atri: ATRI, options: DbPluginOptions<TSchema, TRelations>) {
  if (!initDbPluginOptions) {
    throw new Error('请先通过 initDb 初始化数据库连接')
  }

  const logger = atri.logger.clone({
    title: 'DbPlugin',
  })

  const Drizzle = drizzle(
    initDbPluginOptions.connectString,
    {
      logger: { logQuery: (query, params) => logger.DEBUG('执行数据库查询:', { query, params }) },
      ...initDbPluginOptions.config,
      ...options.config,
    } as DrizzleConfig<TSchema, TRelations>,
  )

  if (options.migration) {
    await migrate(Drizzle, options.migration)
  }

  return Drizzle
}
