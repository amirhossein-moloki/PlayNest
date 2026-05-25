import {
  Reservation,
  Payment,
  PaymentStatus,
  GamingCenter,
  GameStation,
  StaffShift,
  User,
  UserRole,
  PaymentProvider,
  ReservationStatus,
  ReservationSource,
  ReservationPaymentState,
  GameStationType
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { faker } from '@faker-js/faker';

export const createTestGamingCenter = (options?: { name?: string; slug?: string; settings?: any }): Promise<GamingCenter> => {
  const { name = 'Test Gaming Center', slug = 'test-gaming-center', settings } = options || {};
  return prisma.gamingCenter.create({
    data: {
      name,
      slug,
      settings: {
        create: settings || {},
      },
    },
  });
};

export const createTestUser = (gamingCenterId: string, options?: { role?: UserRole; phone?: string }): Promise<User> => {
  const { role = UserRole.STAFF, phone = faker.phone.number() } = options || {};
  return prisma.user.create({
    data: {
      gamingCenterId,
      fullName: faker.person.fullName(),
      phone,
      role,
    },
  });
};

export const createTestStation = (gamingCenterId: string, options?: { name?: string }): Promise<GameStation> => {
  const { name = 'Test Station' } = options || {};
  return prisma.gameStation.create({
    data: {
      gamingCenterId,
      name,
      stationType: GameStationType.PC,
      hourlyPrice: 50000,
    },
  });
};

export const createTestReservation = (
  gamingCenterId: string,
  customerAccountId: string,
  customerProfileId: string,
  stationId: string,
  staffId: string,
  options?: Partial<Reservation>
): Promise<Reservation> => {
  return prisma.reservation.create({
    data: {
      gamingCenterId,
      customerAccountId,
      customerProfileId,
      stationId,
      staffId,
      createdByUserId: staffId,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      stationSnapshot: {
        name: 'Snapshot Station',
        price: 50000,
        durationMinutes: 60,
        currency: 'IRR'
      },
      totalPrice: 50000,
      totalHours: 1,
      status: ReservationStatus.CONFIRMED,
      source: ReservationSource.WALK_IN,
      paymentState: ReservationPaymentState.UNPAID,
      ...options,
    },
  });
};
