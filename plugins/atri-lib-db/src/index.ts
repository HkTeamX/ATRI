import type { AnyRelations, DrizzleConfig, EmptyRelations } from 'drizzle-orm'
import type { MigrationConfig } from 'drizzle-orm/migrator'
import { definePlugin } from '@atri-bot/core'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import PackageJson from '../package.json' with { type: 'json' }

let initDbPluginOptions: InitDbPluginOptions | null = null

export interface InitDbPluginOptions {
  connectString: string
  config?: DrizzleConfig
}

export function InitDbPlugin(options: InitDbPluginOptions) {
  return definePlugin({
    pluginName: `${PackageJson.name}-init-db`,
    async install() {
      try {
        const db = drizzle(options.connectString, options.config ?? {})
        await db.execute(sql`SELECT 1;`)
        initDbPluginOptions = options
        this.logger.INFO('测试数据库连接成功')
      }
      catch (error) {
        this.logger.ERROR('测试数据库连接失败', error)
        throw error
      }
    },
    uninstall() {},
  })
}

export interface DbPluginOptions<TSchema extends Record<string, unknown>, TRelations extends AnyRelations> {
  config: DrizzleConfig<TSchema, TRelations>
  migration?: MigrationConfig
}

export function DbPlugin<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(options: DbPluginOptions<TSchema, TRelations>) {
  if (!initDbPluginOptions) {
    throw new Error('请先通过 InitDbPlugin 插件初始化数据库连接')
  }

  return definePlugin({
    pluginName: `${PackageJson.name}-db`,
    drizzle: drizzle(initDbPluginOptions.connectString, { ...initDbPluginOptions.config, ...options.config } as DrizzleConfig<TSchema, TRelations>),
    async install() {
      // 自动执行迁移
      if (!options.migration) {
        return
      }

      await migrate(this.drizzle, options.migration)
    },
    uninstall() {},
  })
}
