import type { CollectionConfig } from 'payload'

export const EventsCollection: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'startDateTime', 'endDateTime', 'venue', 'updatedAt'],
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
      label: 'Event Title',
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
      name: 'summary',
      type: 'textarea',
      label: 'Event Summary',
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Detailed Description',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Event Banner / Cover Image',
    },
    {
      name: 'startDateTime',
      type: 'date',
      required: true,
      label: 'Start Date & Time',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'endDateTime',
      type: 'date',
      label: 'End Date & Time',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      validate: (val: any, { siblingData }: any) => {
        if (val && siblingData?.startDateTime) {
          const start = new Date(siblingData.startDateTime).getTime()
          const end = new Date(val).getTime()
          if (end < start) {
            return 'End date and time cannot be earlier than start date and time.'
          }
        }
        return true
      },
    },
    {
      name: 'timezone',
      type: 'text',
      required: true,
      defaultValue: 'Asia/Tehran',
      label: 'Timezone (IANA Identifier)',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Completed', value: 'completed' },
      ],
    },
    {
      name: 'venue',
      type: 'relationship',
      relationTo: 'venue-profiles',
      label: 'Venue Reference',
    },
    {
      name: 'locationName',
      type: 'text',
      label: 'Location Name (for external or custom locations)',
    },
    {
      name: 'address',
      type: 'text',
      label: 'Address',
    },
    {
      name: 'latitude',
      type: 'number',
      label: 'Latitude (-90 to 90)',
      validate: (val: any) => {
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (isNaN(num) || num < -90 || num > 90) {
            return 'Latitude must be a valid number between -90 and 90.'
          }
        }
        return true
      },
    },
    {
      name: 'longitude',
      type: 'number',
      label: 'Longitude (-180 to 180)',
      validate: (val: any) => {
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (isNaN(num) || num < -180 || num > 180) {
            return 'Longitude must be a valid number between -180 and 180.'
          }
        }
        return true
      },
    },
    {
      name: 'registrationUrl',
      type: 'text',
      label: 'Registration / Ticket URL',
      validate: (val: any) => {
        if (val) {
          try {
            const url = new URL(val)
            if (!['http:', 'https:'].includes(url.protocol)) {
              return 'Registration URL must use http or https protocol.'
            }
          } catch {
            return 'Registration URL must be a valid URL.'
          }
        }
        return true
      },
    },
    {
      name: 'price',
      type: 'group',
      label: 'Price Information',
      fields: [
        {
          name: 'amount',
          type: 'number',
          label: 'Amount',
        },
        {
          name: 'currency',
          type: 'text',
          defaultValue: 'IRT',
          label: 'Currency Code (e.g. IRT, IRR, USD)',
        },
      ],
    },
    {
      name: 'organizer',
      type: 'text',
      label: 'Event Organizer',
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
