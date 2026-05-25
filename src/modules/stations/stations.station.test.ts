import { prisma } from '../../config/prisma';
import * as serviceLogic from './stations.station';
import { User, GamingCenter } from '@prisma/client';
import { CreateServiceInput } from './stations.types';

describe('Services GameStation Logic Integration Tests', () => {
  let testSalon: GamingCenter;
  let _testUser: User; // eslint-disable-line @typescript-eslint/no-unused-vars

  beforeAll(async () => {
    // Create a gamingCenter for the tests
    testSalon = await prisma.gamingCenter.create({
      data: {
        name: 'Test GamingCenter for Services',
        slug: `test-gamingCenter-stations-${Date.now()}`,
      },
    });
    // Create a user for the tests
    _testUser = await prisma.user.create({
      data: {
        fullName: 'Test User',
        phone: `+989120000000${Date.now()}`.slice(0, 14),
        role: 'MANAGER',
        gamingCenterId: testSalon.id,
      },
    });
  });

  afterAll(async () => {
    // Clean up all created data
    await prisma.gameStation.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.gamingCenter.deleteMany({});
    await prisma.$disconnect();
  });

  describe('createService', () => {
    it('should create a new station and store it in the database', async () => {
      const serviceData: CreateServiceInput = {
        name: 'Manicure',
        durationMinutes: 45,
        price: 75000,
        currency: 'IRR',
      };

      const createdService = await serviceLogic.createService(testSalon.id, serviceData);

      expect(createdService).toBeDefined();
      expect(createdService.id).toBeDefined();
      expect(createdService.name).toBe(serviceData.name);
      expect(createdService.price).toBe(serviceData.price);
      expect(createdService.gamingCenterId).toBe(testSalon.id);

      // Verify it exists in the DB
      const dbService = await prisma.gameStation.findUnique({
        where: { id: createdService.id },
      });
      expect(dbService).not.toBeNull();
      expect(dbService?.name).toBe(serviceData.name);
    });
  });
});
