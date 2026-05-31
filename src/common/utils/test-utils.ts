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
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export const createTestSalon = (options?: { name?: string; slug?: string; settings?: Record<string, unknown> }): Promise<GamingCenter> => {
  const { name = 'Test Gaming Center', slug = `test-gaming-center-${Date.now()}-${Math.random().toString(36).substring(7)}`, settings } = options || {};
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
  const { gamingCenterId, role = UserRole.STAFF, phone = `+1555${Date.now().toString().slice(-7)}${Math.floor(Math.random()*100)}` } = options;
  return prisma.user.create({
    data: {
      gamingCenterId,
      fullName: 'Test User',
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
  options?: Partial<Omit<Prisma.ReservationUncheckedCreateInput,
    | 'gamingCenterId'
    | 'customerAccountId'
    | 'customerProfileId'
    | 'stationId'
    | 'staffId'
    | 'createdByUserId'
  >>
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

export const cleanupDatabase = async () => {
  // 1. Level 4 (Dependencies of dependencies)
  await prisma.gamingSession.deleteMany();
  await prisma.stationMaintenance.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.earningPayment.deleteMany();
  await prisma.earning.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.staffStationSkill.deleteMany();
  await prisma.staffShift.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.pageSection.deleteMany();
  await prisma.pageSlugHistory.deleteMany();
  await prisma.auditLog.deleteMany();

  // 2. Level 3 (Middle dependencies)
  await prisma.reservation.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.page.deleteMany();

  // 3. Level 2 (Primary entities that have FKs to GamingCenter)
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.gameStation.deleteMany();
  await prisma.phoneOtp.deleteMany();
  await prisma.media.deleteMany();
  await prisma.socialLink.deleteMany();
  await prisma.address.deleteMany();
  await prisma.siteSettings.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.commissionPolicy.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.gamingCenterAnalytics.deleteMany();
  await prisma.staffAnalytics.deleteMany();
  await prisma.stationAnalytics.deleteMany();

  // 4. Level 1 (Independent entities)
  await prisma.customerAccount.deleteMany();

  // 5. Level 0 (Root)
  await prisma.gamingCenter.deleteMany();
};
