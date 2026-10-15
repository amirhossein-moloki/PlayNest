import { createRequire } from 'module'

import type { RequireDrizzleKit } from '../types.js'

const require = createRequire(import.meta.url)

export const requireDrizzleKit: RequireDrizzleKit = () => {
  const drizzleKitApiModule = 'drizzle-kit/api'
  const {
    generateDrizzleJson,
    generateMigration,
    pushSchema,
    upPgSnapshot,
  } = require(drizzleKitApiModule)

  return {
    generateDrizzleJson,
    generateMigration,
    pushSchema,
    upSnapshot: upPgSnapshot,
  }
}
