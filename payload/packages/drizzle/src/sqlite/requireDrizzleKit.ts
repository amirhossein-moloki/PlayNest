import { createRequire } from 'module'

import type { RequireDrizzleKit } from '../types.js'

const require = createRequire(import.meta.url)

export const requireDrizzleKit: RequireDrizzleKit = () => {
  const drizzleKitApiModule = 'drizzle-kit/api'
  const {
    generateSQLiteDrizzleJson,
    generateSQLiteMigration,
    pushSQLiteSchema,
  } = require(drizzleKitApiModule)

  return {
    generateDrizzleJson: generateSQLiteDrizzleJson,
    generateMigration: generateSQLiteMigration,
    pushSchema: pushSQLiteSchema,
  }
}
