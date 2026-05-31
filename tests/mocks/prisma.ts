import { PrismaClient, Prisma } from '@prisma/client';

const basePrisma = new PrismaClient({
  datasources: { db: { url: 'file:./test.db' } },
});

// For SQLite integration testing, we use a simple singleton
export const prisma = basePrisma;

jest.mock('../../src/config/prisma', () => ({
  prisma: basePrisma,
  connectPrisma: jest.fn(),
  disconnectPrisma: jest.fn(),
}));
