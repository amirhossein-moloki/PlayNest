import type { CollectionConfig } from 'payload'

export const VenueProfilesCollection: CollectionConfig = {
  slug: 'venue-profiles',
  admin: {
    useAsTitle: 'sayraVenueId',
    defaultColumns: ['sayraVenueId', 'editorialTitle', 'isFeatured', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeValidate: [
      async ({ data }) => {
        if (data?.sayraVenueId) {
          const sayraApiUrl = process.env.SAYRA_API_INTERNAL_URL || 'http://sayra:3000/api/v1'
          try {
            const res = await fetch(`${sayraApiUrl}/gamingCenters/${data.sayraVenueId}`, {
              signal: AbortSignal.timeout(3000),
            })
            if (!res.ok) {
              if (res.status === 404) {
                throw new Error(`Invalid Sayra Venue ID: Gaming center '${data.sayraVenueId}' does not exist in Sayra.`)
              }
              console.warn(`[Payload] Warning: Sayra API returned status ${res.status} when validating venue '${data.sayraVenueId}'.`)
            }
          } catch (err: any) {
            if (err?.message?.includes('Invalid Sayra Venue ID')) {
              throw err
            }
            console.warn(`[Payload] Warning: Unable to verify Sayra venue ID '${data.sayraVenueId}': ${err?.message || err}`)
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'sayraVenueId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Sayra Gaming Center ID',
      admin: {
        description: 'Enter the stable Sayra Gaming Center CUID identifier.',
      },
    },
    {
      name: 'editorialTitle',
      type: 'text',
      label: 'Editorial Headline',
    },
    {
      name: 'editorialDescription',
      type: 'richText',
      label: 'Editorial Description',
    },
    {
      name: 'heroMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero Promotional Image',
    },
    {
      name: 'gallery',
      type: 'array',
      label: 'Editorial Image Gallery',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      label: 'Featured Venue',
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO Metadata',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'SEO Title',
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'SEO Description',
        },
        {
          name: 'keywords',
          type: 'text',
          label: 'SEO Keywords',
        },
      ],
    },
  ],
}
