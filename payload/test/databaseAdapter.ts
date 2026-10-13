import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'

const isSqlite =
  process.env.PAYLOAD_DATABASE === 'sqlite' ||
  process.env.PAYLOAD_DATABASE === 'sqlite-uuid' ||
  process.env.PAYLOAD_DATABASE === 'sqlite-uuidv7'

export const databaseAdapter = isSqlite
  ? sqliteAdapter({
      client: {
        url: process.env.SQLITE_URL || 'file:./payload_build.db',
      },
    })
  : postgresAdapter({
      pool: {
        get connectionString() {
          return (
            process.env.DATABASE_URI ||
            process.env.POSTGRES_URL ||
            process.env.DATABASE_URL ||
            'postgresql://playenest_admin:change_this_secure_password_in_production@db:5432/payload_db'
          )
        },
      },
      push: true,
    })
