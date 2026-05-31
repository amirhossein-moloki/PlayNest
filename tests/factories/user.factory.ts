import { v4 as uuidv4 } from 'uuid';

export const UserFactory = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      phone: '09123456789',
      passwordHash: 'hashed_password',
      phoneVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },
};

export const SessionFactory = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      actorId: uuidv4(),
      actorType: 'USER',
      tokenHash: 'token_hash',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },
};
