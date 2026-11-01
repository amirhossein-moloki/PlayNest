import {
  PrismaClient,
  ReservationStatus,
  ReservationSource,
  ReservationPaymentState,
  CancellationCategory,
  CancellationActor,
} from '@prisma/client';
import { PRNG } from '../prng';
import { SeedStationInfo } from './stations';
import { SeededStaffUsers, SeededCustomers } from './users';

export interface SeededReservationInfo {
  id: string;
  gamingCenterId: string;
  stationId: string;
  customerProfileId: string;
  customerAccountId: string;
  startTime: Date;
  endTime: Date;
  totalHours: number;
  totalPrice: number;
  discountAmount: number;
  status: ReservationStatus;
  paymentState: ReservationPaymentState;
  source: ReservationSource;
  isPast: boolean;
}

export async function seedReservations(
  prisma: PrismaClient,
  stations: SeedStationInfo[],
  staff: SeededStaffUsers,
  customers: SeededCustomers,
  discounts: { id: string; gamingCenterId: string; percent?: number }[],
  prng: PRNG
): Promise<SeededReservationInfo[]> {
  const allReservations: SeededReservationInfo[] = [];

  const stationsByCenter: Record<string, SeedStationInfo[]> = {};
  for (const s of stations) {
    if (!stationsByCenter[s.gamingCenterId]) stationsByCenter[s.gamingCenterId] = [];
    stationsByCenter[s.gamingCenterId].push(s);
  }

  const slotTemplates = [
    { startHour: 10, startMin: 0, durationHours: 2 },
    { startHour: 12, startMin: 30, durationHours: 1.5 },
    { startHour: 14, startMin: 30, durationHours: 2 },
    { startHour: 17, startMin: 0, durationHours: 2 },
    { startHour: 19, startMin: 30, durationHours: 2 },
    { startHour: 21, startMin: 45, durationHours: 1.5 },
  ];

  const now = new Date();
  const dayMillis = 24 * 3600 * 1000;

  for (const [centerId, centerStations] of Object.entries(stationsByCenter)) {
    const centerProfiles = customers.profilesByCenter[centerId];
    if (!centerProfiles || centerProfiles.length === 0) continue;

    const centerStaff = staff.staffIdsByCenter[centerId] || [];
    const managerId = staff.managerIdByCenter[centerId];
    const centerDiscount = discounts.find((d) => d.gamingCenterId === centerId);

    for (let dayOffset = -25; dayOffset <= 5; dayOffset++) {
      const targetDate = new Date(now.getTime() + dayOffset * dayMillis);
      const isWeekend = targetDate.getDay() === 4 || targetDate.getDay() === 5;
      const stationSubList = prng.shuffle(centerStations).slice(0, isWeekend ? centerStations.length : Math.ceil(centerStations.length * 0.7));

      for (const station of stationSubList) {
        const numSlots = prng.randInt(1, 3);
        const selectedSlotIndexes = prng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, numSlots).sort((a, b) => a - b);

        for (const slotIdx of selectedSlotIndexes) {
          const slot = slotTemplates[slotIdx];
          const startTime = new Date(targetDate);
          startTime.setHours(slot.startHour, slot.startMin, 0, 0);

          const durationMs = slot.durationHours * 3600 * 1000;
          const endTime = new Date(startTime.getTime() + durationMs);

          const isPast = endTime.getTime() < now.getTime();
          const isOngoing = startTime.getTime() <= now.getTime() && endTime.getTime() > now.getTime();

          const profileId = prng.pick(centerProfiles);
          const accountId = customers.profileToAccountMap[profileId];
          const assignedStaffId = centerStaff.length > 0 ? prng.pick(centerStaff) : managerId;

          const basePrice = Math.round(station.hourlyPrice * slot.durationHours);
          const hasDiscount = prng.chance(0.25) && centerDiscount;
          const discountAmount = hasDiscount ? Math.round(basePrice * 0.15) : 0;
          const totalPrice = basePrice - discountAmount;

          let status: ReservationStatus;
          let paymentState: ReservationPaymentState;
          let cancelCategory: CancellationCategory | null = null;
          let cancelActor: CancellationActor | null = null;
          let cancelReason: string | null = null;
          let canceledAt: Date | null = null;

          if (isPast) {
            const rand = prng.next();
            if (rand < 0.8) {
              status = ReservationStatus.COMPLETED;
              paymentState = ReservationPaymentState.PAID;
            } else if (rand < 0.9) {
              status = ReservationStatus.CANCELED;
              paymentState = prng.pick([ReservationPaymentState.REFUNDED, ReservationPaymentState.UNPAID]);
              cancelCategory = prng.pick([CancellationCategory.CUSTOMER_CANCEL, CancellationCategory.SCHEDULE_CONFLICT]);
              cancelActor = CancellationActor.CUSTOMER;
              cancelReason = 'انصراف مشتری به دلیل تغییر برنامه کاری';
              canceledAt = new Date(startTime.getTime() - 3600 * 1000);
            } else {
              status = ReservationStatus.NO_SHOW;
              paymentState = ReservationPaymentState.PAID;
            }
          } else if (isOngoing) {
            status = ReservationStatus.IN_PROGRESS;
            paymentState = ReservationPaymentState.PAID;
          } else {
            const rand = prng.next();
            if (rand < 0.75) {
              status = ReservationStatus.CONFIRMED;
              paymentState = ReservationPaymentState.PAID;
            } else if (rand < 0.95) {
              status = ReservationStatus.PENDING;
              paymentState = ReservationPaymentState.UNPAID;
            } else {
              status = ReservationStatus.CANCELED;
              paymentState = ReservationPaymentState.REFUNDED;
              cancelCategory = CancellationCategory.CENTER_CANCEL;
              cancelActor = CancellationActor.STAFF;
              cancelReason = 'عدم امکان سرویس‌دهی به دلیل تعمیرات فوری سیستم';
              canceledAt = new Date(Date.now() - 3600 * 1000);
            }
          }

          const reservation = await prisma.reservation.create({
            data: {
              gamingCenterId: centerId,
              customerProfileId: profileId,
              customerAccountId: accountId,
              stationId: station.id,
              staffId: assignedStaffId,
              createdByUserId: managerId,
              startTime,
              endTime,
              totalHours: slot.durationHours,
              totalPrice,
              discountAmount,
              status,
              source: prng.pick([ReservationSource.ONLINE, ReservationSource.WALK_IN]),
              paymentState,
              stationSnapshot: {
                name: station.name,
                stationType: station.stationType,
                isVip: station.isVip,
                hourlyPrice: station.hourlyPrice,
              },
              completedAt: status === ReservationStatus.COMPLETED ? endTime : null,
              canceledAt,
              cancelCategory,
              cancelActor,
              cancelReason,
            },
          });

          await prisma.reservationHistory.create({
            data: {
              reservationId: reservation.id,
              fromStatus: ReservationStatus.PENDING,
              toStatus: status,
              action: status === ReservationStatus.COMPLETED ? 'COMPLETE' : status === ReservationStatus.CANCELED ? 'CANCEL' : 'CONFIRM',
              actorId: assignedStaffId,
              actorType: 'USER',
              reason: 'ثبت سیستمی اولیه و تایید رزرو',
              createdAt: new Date(startTime.getTime() - 2 * 3600 * 1000),
            },
          });

          allReservations.push({
            id: reservation.id,
            gamingCenterId: centerId,
            stationId: station.id,
            customerProfileId: profileId,
            customerAccountId: accountId,
            startTime,
            endTime,
            totalHours: slot.durationHours,
            totalPrice,
            discountAmount,
            status,
            paymentState,
            source: reservation.source,
            isPast,
          });
        }
      }
    }
  }

  return allReservations;
}
