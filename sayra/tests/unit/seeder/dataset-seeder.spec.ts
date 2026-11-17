import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('argon2', () => ({
  hash: jest.fn().mockImplementation(async () => 'hashed_password'),
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs') as any;
  return {
    ...actualFs,
    readFileSync: jest.fn(),
  };
});

import { seedFromDataset } from '../../../prisma/seed/dataset-seeder';
import * as fs from 'fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('DatasetSeeder Unit Tests', () => {
  let mockPrisma: any;

  const mockDataset = {
    metadata: { version: '1.0' },
    gamingCenters: [
      {
        id: 'center_07',
        name: 'Nexus Game Arena',
        slug: 'nexus-game-arena',
        description: 'Premier gaming center',
        phone: '02188880007',
        email: 'info@nexusarena.ir',
        address: 'Tehran, Valiasr St',
        city: 'Tehran',
        state: 'Tehran',
        latitude: 35.7152,
        longitude: 51.4043,
        isActive: true,
      },
    ],
    gameStations: [
      {
        id: 'station_07_001',
        gamingCenterId: 'center_07',
        name: 'PS5 Station 1',
        stationType: 'PLAYSTATION',
        hourlyPrice: 80000,
        isActive: true,
        pricingMode: 'SIMPLE',
      },
    ],
    users: [],
    customerAccounts: [
      {
        id: 'cust_acc_07_001',
        phone: '09120000007',
        email: 'player07@example.com',
        role: 'CUSTOMER',
        isActive: true,
      },
    ],
    customerProfiles: [
      {
        id: 'cust_prof_07_001',
        customerAccountId: 'cust_acc_07_001',
        gamingCenterId: 'center_07',
        fullName: 'Ali Rezaei',
        displayName: 'AliGamer',
      },
    ],
    reservations: [
      {
        id: 'reservation_07_007',
        gamingCenterId: 'center_07',
        stationId: 'station_07_001',
        customerAccountId: 'cust_acc_07_001',
        customerProfileId: 'cust_prof_07_001',
        startTime: '2026-11-17T14:00:00Z',
        endTime: '2026-11-17T16:00:00Z',
        partySize: 2,
        totalPrice: 160000,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        source: 'ONLINE',
      },
    ],
    gamingSessions: [
      {
        id: 'session_07_001',
        reservationId: 'reservation_07_007',
        stationId: 'station_07_001',
        startTime: '2026-11-17T14:05:00Z',
        endTime: '2026-11-17T16:00:00Z',
        status: 'COMPLETED',
        actualHours: 1.9,
      },
    ],
    payments: [],
    platformLedger: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockDataset));

    mockPrisma = {
      gamingCenter: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      gameStation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerAccount: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerProfile: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      reservation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      gamingSession: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      reservationHistory: {
        create: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      platformLedger: {
        create: jest.fn(),
      },
      wallet: {
        create: jest.fn(),
      },
      settings: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      siteSettings: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      gamingCenterSchedule: {
        create: jest.fn(),
      },
    };
  });

  it('should seed data creating internal CUIDs without inserting raw seed IDs into primary keys', async () => {
    // 1. Center doesn't exist -> create returns record with generated CUID
    mockPrisma.gamingCenter.findFirst.mockResolvedValue(null);
    mockPrisma.gamingCenter.create.mockResolvedValue({
      id: 'cuid_center_123',
      slug: 'nexus-game-arena',
      name: 'Nexus Game Arena',
    });

    // 2. Station doesn't exist -> create
    mockPrisma.gameStation.findFirst.mockResolvedValue(null);
    mockPrisma.gameStation.create.mockResolvedValue({
      id: 'cuid_station_456',
      gamingCenterId: 'cuid_center_123',
      name: 'PS5 Station 1',
    });

    // 3. Customer account & profile
    mockPrisma.customerAccount.findFirst.mockResolvedValue(null);
    mockPrisma.customerAccount.create.mockResolvedValue({
      id: 'cuid_account_789',
      phone: '09120000007',
    });
    mockPrisma.customerProfile.findUnique.mockResolvedValue(null);
    mockPrisma.customerProfile.create.mockResolvedValue({
      id: 'cuid_profile_101',
      gamingCenterId: 'cuid_center_123',
      customerAccountId: 'cuid_account_789',
    });

    // 4. Reservation doesn't exist -> create
    mockPrisma.reservation.findFirst.mockResolvedValue(null);
    mockPrisma.reservation.create.mockResolvedValue({
      id: 'cuid_res_202',
      gamingCenterId: 'cuid_center_123',
      stationId: 'cuid_station_456',
    });

    // 5. Gaming session doesn't exist -> create
    mockPrisma.gamingSession.findFirst.mockResolvedValue(null);
    mockPrisma.gamingSession.create.mockResolvedValue({
      id: 'cuid_sess_303',
      reservationId: 'cuid_res_202',
      stationId: 'cuid_station_456',
    });

    const metrics = await seedFromDataset(mockPrisma, '/fake/path/dataset.json');

    expect(metrics.newCentersCreated).toBe(1);
    expect(metrics.newStationsCreated).toBe(1);
    expect(metrics.failedOperationsCount).toBe(0);

    // Verify center was created without explicit id
    const centerCreateCall = mockPrisma.gamingCenter.create.mock.calls[0][0];
    expect(centerCreateCall.data.id).toBeUndefined();
    expect(centerCreateCall.data.slug).toBe('nexus-game-arena');

    // Verify station was created with actual database CUID as foreign key
    const stationCreateCall = mockPrisma.gameStation.create.mock.calls[0][0];
    expect(stationCreateCall.data.id).toBeUndefined();
    expect(stationCreateCall.data.gamingCenterId).toBe('cuid_center_123'); // DB CUID, NOT 'center_07'

    // Verify reservation used mapped DB CUIDs
    const resCreateCall = mockPrisma.reservation.create.mock.calls[0][0];
    expect(resCreateCall.data.id).toBeUndefined();
    expect(resCreateCall.data.gamingCenterId).toBe('cuid_center_123');
    expect(resCreateCall.data.stationId).toBe('cuid_station_456');
    expect(resCreateCall.data.customerProfileId).toBe('cuid_profile_101');

    // Verify gaming session used mapped DB CUIDs
    const sessionCreateCall = mockPrisma.gamingSession.create.mock.calls[0][0];
    expect(sessionCreateCall.data.id).toBeUndefined();
    expect(sessionCreateCall.data.reservationId).toBe('cuid_res_202');
    expect(sessionCreateCall.data.stationId).toBe('cuid_station_456');
  });

  it('should be idempotent on repeated runs without creating duplicate records', async () => {
    // Existing records found in DB
    mockPrisma.gamingCenter.findFirst.mockResolvedValue({
      id: 'existing_cuid_center',
      slug: 'nexus-game-arena',
      name: 'Nexus Game Arena',
      description: 'Premier gaming center',
      phone: '02188880007',
      email: 'info@nexusarena.ir',
      address: 'Tehran, Valiasr St',
      city: 'Tehran',
      state: 'Tehran',
      latitude: 35.7152,
      longitude: 51.4043,
      isActive: true,
    });
    mockPrisma.gamingCenter.update.mockResolvedValue({});

    mockPrisma.gameStation.findFirst.mockResolvedValue({
      id: 'existing_cuid_station',
      gamingCenterId: 'existing_cuid_center',
      name: 'PS5 Station 1',
      stationType: 'PLAYSTATION',
      hourlyPrice: 80000,
      isActive: true,
      pricingMode: 'SIMPLE',
    });

    mockPrisma.customerAccount.findFirst.mockResolvedValue({
      id: 'existing_cuid_acc',
      phone: '09120000007',
      email: 'player07@example.com',
      role: 'CUSTOMER',
      isActive: true,
    });

    mockPrisma.customerProfile.findUnique.mockResolvedValue({
      id: 'existing_cuid_prof',
      gamingCenterId: 'existing_cuid_center',
      customerAccountId: 'existing_cuid_acc',
      displayName: 'AliGamer',
    });

    mockPrisma.reservation.findFirst.mockResolvedValue({
      id: 'existing_cuid_res',
      gamingCenterId: 'existing_cuid_center',
      stationId: 'existing_cuid_station',
      customerProfileId: 'existing_cuid_prof',
      customerAccountId: 'existing_cuid_acc',
      startTime: new Date('2026-11-17T14:00:00Z'),
      endTime: new Date('2026-11-17T16:00:00Z'),
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    });

    mockPrisma.gamingSession.findFirst.mockResolvedValue({
      id: 'existing_cuid_session',
      reservationId: 'existing_cuid_res',
      stationId: 'existing_cuid_station',
      status: 'COMPLETED',
    });

    const metrics = await seedFromDataset(mockPrisma, '/fake/path/dataset.json');

    expect(metrics.newCentersCreated).toBe(0);
    expect(metrics.centersUpdated).toBe(1);
    expect(metrics.newStationsCreated).toBe(0);
    expect(metrics.duplicateRecordsIdentified).toBeGreaterThan(0);
    expect(metrics.failedOperationsCount).toBe(0);

    // No new creates should have been called
    expect(mockPrisma.gamingCenter.create).not.toHaveBeenCalled();
    expect(mockPrisma.gameStation.create).not.toHaveBeenCalled();
    expect(mockPrisma.reservation.create).not.toHaveBeenCalled();
    expect(mockPrisma.gamingSession.create).not.toHaveBeenCalled();
  });

  it('should skip dependent records and log failure when parent entity mapping is missing', async () => {
    // Center creation fails or center is missing
    mockPrisma.gamingCenter.findFirst.mockResolvedValue(null);
    mockPrisma.gamingCenter.create.mockRejectedValue(new Error('DB connection timeout'));

    const metrics = await seedFromDataset(mockPrisma, '/fake/path/dataset.json');

    expect(metrics.failedOperationsCount).toBeGreaterThan(0);
    // Station cannot be created because center_07 is not in centerIdMap
    expect(mockPrisma.gameStation.create).not.toHaveBeenCalled();
    // Reservation cannot be created because center and station are missing
    expect(mockPrisma.reservation.create).not.toHaveBeenCalled();
    // Session cannot be created
    expect(mockPrisma.gamingSession.create).not.toHaveBeenCalled();
  });
});
