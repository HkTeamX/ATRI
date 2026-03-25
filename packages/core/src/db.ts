import type { Logger, LogLevelType } from '@huan_kong/logger'
import type { AnyRelations, DrizzleConfig } from 'drizzle-orm'
import type { MigrationConfig } from 'drizzle-orm/migrator'
import type { ATRI } from './atri.js'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

export interface DBConfig {
  connectionString: string
  logLevel?: LogLevelType
}

export interface DBAddOptions<TSchema extends Record<string, unknown>, TRelations extends AnyRelations> {
  pluginName: string
  config: DrizzleConfig<TSchema, TRelations>
  migration?: MigrationConfig
}

export class DB {
  logger: Logger
  config: DBConfig

  constructor(atri: ATRI, config: DBConfig) {
    this.logger = atri.logger.clone({
      title: 'DB',
      level: config.logLevel,
    })
    this.config = config

    // 测试链接
    this.testConnection({})
  }

  private async testConnection<
    TSchema extends Record<string, unknown>,
    TRelations extends AnyRelations,
  >(config: DrizzleConfig<TSchema, TRelations>,
  ) {
    const db = drizzle<TSchema, TRelations>(this.config.connectionString, config)

    try {
      await db.execute('SELECT 1')
      this.logger.INFO('数据库连接成功')
    }
    catch (error) {
      this.logger.ERROR('数据库连接失败', error)
      throw error
    }

    return db
  }

  async add<
    TSchema extends Record<string, unknown>,
    TRelations extends AnyRelations,
  >(
    options: DBAddOptions<TSchema, TRelations>,
  ) {
    const db = await this.testConnection(options.config)

    // 是否需要执行迁移
    if (options.migration) {
      await migrate(db, {
        ...options.migration,
        migrationsTable: options.migration.migrationsTable ?? `migrations_${Date.now()}`,
      })
    }

    return db
  }
}
