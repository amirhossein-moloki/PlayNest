import { v4 as uuidv4 } from 'uuid';

export const UserFactory = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      phone: '09000000000',
      passwordHash: 'h_t',
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
      tokenHash: 'h_t',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },
};
