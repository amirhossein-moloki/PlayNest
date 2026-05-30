import {
  Reservation,
  GamingCenter,
  GameStation,
  User,
  UserRole,
  ReservationStatus,
  ReservationSource,
  ReservationPaymentState,
  GameStationType,
  SessionActorType,
  StaffShift,
  ShiftRole,
  Payment,
  PaymentStatus,
  PaymentProvider,
  PaymentMethod,
  Prisma
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export const createTestSalon = (options?: { name?: string; slug?: string; settings?: Record<string, unknown> }): Promise<GamingCenter> => {
  const { name = 'Test Gaming Center', slug = faker.lorem.slug(), settings } = options || {};
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

export const createTestGamingCenter = createTestSalon;

export const createTestUser = (options: { gamingCenterId: string; role?: UserRole; phone?: string }): Promise<User> => {
  const { gamingCenterId, role = UserRole.STAFF, phone = faker.phone.number() } = options;
  return prisma.user.create({
    data: {
      gamingCenterId,
      fullName: faker.person.fullName(),
      phone,
      role,
    },
  });
};

export const createTestStation = (options: { gamingCenterId: string } & Partial<Omit<GameStation, 'gamingCenterId'>>): Promise<GameStation> => {
  const { gamingCenterId, name = 'Test Station', stationType = GameStationType.PC, hourlyPrice = 50000 } = options;
  return prisma.gameStation.create({
    data: {
      ...options,
      gamingCenterId,
      name,
      stationType,
      hourlyPrice,
    },
  });
};

export const createTestService = createTestStation;

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
        hourlyPrice: 50000,
        stationType: GameStationType.PC,
      } as Prisma.InputJsonValue,
      totalPrice: 50000,
      totalHours: 1,
      status: ReservationStatus.CONFIRMED,
      source: ReservationSource.WALK_IN,
      paymentState: ReservationPaymentState.UNPAID,
      ...options,
    },
  });
};

export const createTestShift = (options: {
    gamingCenterId: string;
    userId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    shiftRole?: ShiftRole;
  }): Promise<StaffShift> => {
  return prisma.staffShift.create({
    data: {
      ...options,
      shiftRole: options.shiftRole || ShiftRole.HOST,
    },
  });
};

export const createTestPayment = (options: {
    gamingCenterId: string;
    reservationId: string;
    amount?: number;
    status?: PaymentStatus;
    provider?: PaymentProvider;
  }): Promise<Payment> => {
  return prisma.payment.create({
    data: {
      gamingCenterId: options.gamingCenterId,
      reservationId: options.reservationId,
      amount: options.amount || 1000,
      currency: 'IRR',
      status: options.status || PaymentStatus.PENDING,
      provider: options.provider || PaymentProvider.MANUAL,
      method: PaymentMethod.ONLINE,
    },
  });
};

export const generateToken = (payload: { actorId: string; actorType: SessionActorType | string; sessionId?: string }): string => {
  return jwt.sign(
    {
      actorId: payload.actorId,
      actorType: payload.actorType,
      sessionId: payload.sessionId || 'test-session-id',
    },
    env.JWT_ACCESS_SECRET as string
  );
};
