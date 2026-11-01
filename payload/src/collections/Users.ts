import type { CollectionConfig } from 'payload'

export const UsersCollection: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'updatedAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user && ((req.user as any).role === 'platform-admin' || (req.user as any).isSuperuser)),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user && ((req.user as any).role === 'platform-admin' || (req.user as any).isSuperuser)),
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      defaultValue: 'editor',
      options: [
        { label: 'Platform Admin (Superuser)', value: 'platform-admin' },
        { label: 'Editor', value: 'editor' },
      ],
      access: {
        update: ({ req }) => Boolean(req.user && ((req.user as any).role === 'platform-admin' || (req.user as any).isSuperuser)),
      },
    },
    {
      name: 'isSuperuser',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Designates that this user has all permissions without explicitly assigning them.',
      },
      access: {
        update: ({ req }) => Boolean(req.user && ((req.user as any).role === 'platform-admin' || (req.user as any).isSuperuser)),
      },
    },
  ],
}
