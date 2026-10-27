import type { CollectionConfig } from 'payload'
import { lexicalEditor, BlocksFeature } from '@payloadcms/richtext-lexical'
import { ALL_ARTICLE_BLOCKS } from '../blocks/index.js'

export const ArticlesCollection: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'publishedAt', 'updatedAt'],
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return {
        status: {
          equals: 'published',
        },
      }
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Article Title',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Slug',
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Article Body',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          BlocksFeature({
            blocks: ALL_ARTICLE_BLOCKS,
          }),
        ],
      }),
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      required: true,
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'featuredVenues',
      type: 'array',
      label: 'Featured Sayra Venues',
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
      name: 'heroMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Featured Cover Image',
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
