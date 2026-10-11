import type { CollectionConfig } from 'payload'

export const CityLandingPagesCollection: CollectionConfig = {
  slug: 'city-landing-pages',
  admin: {
    useAsTitle: 'cityName',
    defaultColumns: ['cityName', 'citySlug', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'cityName',
      type: 'text',
      required: true,
      label: 'City Name',
    },
    {
      name: 'citySlug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'City Slug',
    },
    {
      name: 'introText',
      type: 'richText',
      label: 'Introductory Editorial Text',
    },
    {
      name: 'featuredVenues',
      type: 'array',
      label: 'Featured Sayra Venues in City',
      fields: [
        {
          name: 'sayraVenueId',
          type: 'text',
          required: true,
          label: 'Sayra Gaming Center ID',
        },
      ],
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
