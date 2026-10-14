import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sharpTransformer } from '@payloadcms/transformer-sharp'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'node:url'
import path from 'path'
import sharp from 'sharp'

import { UsersCollection } from './collections/Users.js'
import { MediaCollection } from './collections/Media.js'
import { ArticlesCollection } from './collections/Articles.js'
import { CityLandingPagesCollection } from './collections/CityLandingPages.js'
import { VenueProfilesCollection } from './collections/VenueProfiles.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: UsersCollection.slug,
    autoLogin: false,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    UsersCollection,
    MediaCollection,
    ArticlesCollection,
    CityLandingPagesCollection,
    VenueProfilesCollection,
  ],
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || 'change_this_payload_secret_in_production',
  db: postgresAdapter({
    push: process.env.PAYLOAD_DB_PUSH === 'true',
    pool: {
      get connectionString() {
        return (
          process.env.DATABASE_URI ||
          process.env.POSTGRES_URL ||
          'postgresql://playenest_admin:change_this_secure_password_in_production@db:5432/payload_db'
        )
      },
    },
  }),
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
  upload: {
    transformers: [sharpTransformer({ sharp })],
  },
})
