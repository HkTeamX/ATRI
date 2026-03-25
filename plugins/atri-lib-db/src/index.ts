import type { AnyRelations, DrizzleConfig, EmptyRelations } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres/driver.js'
import type { MigrationConfig } from 'drizzle-orm/migrator'
import { definePlugin } from '@atri-bot/core'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import PackageJson from '../package.json' with { type: 'json' }

export interface DbPluginProps<TSchema extends Record<string, unknown>, TRelations extends AnyRelations> {
  drizzle?: BunSQLDatabase<TSchema, TRelations> & { $client: Bun.SQL }
}

export interface DbPluginConfig {
  connectionString?: string
}

export interface DbPluginOptions<TSchema extends Record<string, unknown>, TRelations extends AnyRelations> extends DbPluginConfig {
  pluginName: string
  config: DrizzleConfig<TSchema, TRelations>
  migration?: MigrationConfig
}

export function DbPlugin<TSchema extends Record<string, unknown>, TRelations extends AnyRelations = EmptyRelations>(options: DbPluginOptions<TSchema, TRelations>) {
  return definePlugin<DbPluginProps<TSchema, TRelations>, DbPluginConfig>(() => {
    let drizzleClient: (BunSQLDatabase<TSchema, TRelations> & { $client: Bun.SQL }) | undefined

    return {
      pluginName: PackageJson.name,
      defaultConfig: {
        connectionString: '',
      },
      get drizzle() {
        return drizzleClient
      },
      async install() {
        const connectionString = options.connectionString ?? this.config.connectionString

        if (!connectionString || connectionString === '') {
          const errorMessage = '请至少通过插件配置文件或 DbPlugin options 提供 connectionString 参数。'
          this.logger.ERROR(errorMessage)
          throw new Error(errorMessage)
        }

        drizzleClient = drizzle(connectionString, options.config)

        if (!options.migration) {
          return
        }

        await migrate(drizzleClient, {
          ...options.migration,
          migrationsTable: options.migration.migrationsTable ?? `migrations_${options.pluginName}`,
        })
      },
      uninstall() {
        drizzleClient = undefined
      },
    }
  })
}
