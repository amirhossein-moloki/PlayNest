import { sqliteAdapter } from '@payloadcms/db-sqlite'

export const databaseAdapter = sqliteAdapter({
  client: {
    url: 'file:./payload_build.db',
  },
})
