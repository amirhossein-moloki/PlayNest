/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
const fn = (returnValue?: any) => {
  const mock = (...args: any[]) => Promise.resolve(returnValue);
  (mock as any).mockResolvedValue = (val: any) => { returnValue = val; return mock; };
  return mock;
};

const gc = { id: 'gc-1', name: 'Test Center', slug: 'test-center', isActive: true };
const user = { id: 'u-1', fullName: 'Admin', role: 'MANAGER', gamingCenterId: 'gc-1' };

export const prismaMock = {
  gamingCenter: {
    findUnique: fn(gc),
    findFirst: fn(gc),
    create: fn(gc),
    update: fn(gc),
    delete: fn(gc),
    findMany: fn([gc]),
  },
  user: {
    findUnique: fn(user),
    findFirst: fn(user),
    create: fn(user),
    update: fn(user),
    delete: fn(user),
    findMany: fn([user]),
  },
  page: {
    findUnique: fn(),
    findFirst: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
    findMany: fn([]),
    count: fn(0),
  },
  pageSection: {
    findMany: fn([]),
    create: fn(),
    update: fn(),
    delete: fn(),
  },
  siteSettings: {
    findUnique: fn({ gamingCenterId: 'gc-1' }),
  },
  session: {
    findUnique: fn({ id: 's-1', actorId: 'u-1', actorType: 'USER', expiresAt: new Date(Date.now() + 1000000) }),
  },
  $connect: fn(),
  $disconnect: fn(),
  $transaction: (cb: any) => cb(prismaMock),
  $extends: () => prismaMock,
};
