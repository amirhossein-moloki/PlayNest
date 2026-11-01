import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
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
import { EventsCollection } from './collections/Events.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isProduction = process.env.NODE_ENV === 'production'
const payloadSecret = process.env.PAYLOAD_SECRET

if (isProduction && (!payloadSecret || payloadSecret === 'generate_a_secure_payload_secret_at_least_32_chars' || payloadSecret === 'change_this_payload_secret_in_production')) {
  throw new Error('PAYLOAD_SECRET must be set to a secure, non-default value in production.')
}

const secret = payloadSecret || 'dev_payload_secret_32_characters_minimum_length'

const smtpHost = process.env.PAYLOAD_SMTP_HOST
const smtpPort = process.env.PAYLOAD_SMTP_PORT ? parseInt(process.env.PAYLOAD_SMTP_PORT, 10) : 587
const smtpUser = process.env.PAYLOAD_SMTP_USER
const smtpPassword = process.env.PAYLOAD_SMTP_PASSWORD
const smtpSecure = process.env.PAYLOAD_SMTP_SECURE === 'true'
const smtpFromAddress = process.env.PAYLOAD_SMTP_FROM_ADDRESS || 'cms@playenest.com'
const smtpFromName = process.env.PAYLOAD_SMTP_FROM_NAME || 'PlayNest CMS'

export default buildConfig({
  admin: {
    user: UsersCollection.slug,
    autoLogin: false,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  graphQL: {
    disable: false,
    disablePlaygroundInProduction: true,
  },
  collections: [
    UsersCollection,
    MediaCollection,
    ArticlesCollection,
    CityLandingPagesCollection,
    VenueProfilesCollection,
    EventsCollection,
  ],
  editor: lexicalEditor({}),
  secret,
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
  ...(smtpHost
    ? {
        email: nodemailerAdapter({
          defaultFromAddress: smtpFromAddress,
          defaultFromName: smtpFromName,
          transportOptions: {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            ...(smtpUser && smtpPassword
              ? {
                  auth: {
                    user: smtpUser,
                    pass: smtpPassword,
                  },
                }
              : {}),
          },
        }),
      }
    : {}),
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
  upload: {
    transformers: [sharpTransformer({ sharp })],
  },
})
