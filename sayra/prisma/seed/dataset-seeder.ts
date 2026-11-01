import {
  PrismaClient,
  UserRole,
  ShiftRole,
  GameStationType,
  ReservationStatus,
  ReservationPaymentState,
  ReservationSource,
  GamingSessionStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentProvider,
  CommissionType,
  RatingStatus,
  PageType,
  PageStatus,
  LinkType,
  RobotsIndex,
  RobotsFollow,
  LedgerEntryType,
  CommissionStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';

export interface SeedReportMetrics {
  newCentersCreated: number;
  centersUpdated: number;
  centersUnchanged: number;
  newStationsCreated: number;
  stationsUpdated: number;
  dependentRecordsCreated: number;
  duplicateRecordsIdentified: number;
  failedOperationsCount: number;
  elapsedTimeMs: number;
}

export async function seedFromDataset(
  prisma: PrismaClient,
  datasetFilePath: string,
  defaultPassword = 'PlayNest@2026'
): Promise<SeedReportMetrics> {
  const startTime = Date.now();
  const metrics: SeedReportMetrics = {
    newCentersCreated: 0,
    centersUpdated: 0,
    centersUnchanged: 0,
    newStationsCreated: 0,
    stationsUpdated: 0,
    dependentRecordsCreated: 0,
    duplicateRecordsIdentified: 0,
    failedOperationsCount: 0,
    elapsedTimeMs: 0,
  };

  const rawJson = fs.readFileSync(datasetFilePath, 'utf-8');
  const dataset = JSON.parse(rawJson);
  const commonPasswordHash = await argon2.hash(defaultPassword);

  // 1. Platform Admin
  if (Array.isArray(dataset.platformAdmin)) {
    for (const adminData of dataset.platformAdmin) {
      try {
        const existing = await prisma.platformAdmin.findFirst({
          where: {
            OR: [
              ...(adminData.id ? [{ id: adminData.id }] : []),
              ...(adminData.phone ? [{ phone: adminData.phone }] : []),
              ...(adminData.email ? [{ email: adminData.email }] : []),
            ],
          },
        });

        if (!existing) {
          await prisma.platformAdmin.create({
            data: {
              ...(adminData.id ? { id: adminData.id } : {}),
              fullName: adminData.fullName || 'مدیر کل سامانه پلی‌نست',
              phone: adminData.phone,
              email: adminData.email || 'superadmin@example.test',
              passwordHash: commonPasswordHash,
              isActive: adminData.isActive ?? true,
              isSuperuser: adminData.isSuperuser ?? true,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed to seed PlatformAdmin ${adminData.phone}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // Map to hold center and related entity IDs
  const centerIdMap = new Map<string, string>(); // dataset center ID -> DB center ID

  // 2. Gaming Centers
  if (Array.isArray(dataset.gamingCenters)) {
    for (const c of dataset.gamingCenters) {
      try {
        const existing = await prisma.gamingCenter.findFirst({
          where: {
            OR: [
              ...(c.id ? [{ id: c.id }] : []),
              ...(c.slug ? [{ slug: c.slug }] : []),
            ],
          },
        });

        if (!existing) {
          const created = await prisma.gamingCenter.create({
            data: {
              ...(c.id ? { id: c.id } : {}),
              name: c.name,
              slug: c.slug,
              isActive: c.isActive ?? true,
              description: c.description || null,
              openingTime: c.openingTime || '10:00',
              closingTime: c.closingTime || '23:00',
              hourlyRate: typeof c.hourlyRate === 'number' ? c.hourlyRate : 0,
              vipHourlyRate: typeof c.vipHourlyRate === 'number' ? c.vipHourlyRate : null,
              pcCount: typeof c.pcCount === 'number' ? c.pcCount : 10,
              consoleCount: typeof c.consoleCount === 'number' ? c.consoleCount : 4,
              hasFoodService: Boolean(c.hasFoodService),
              games: Array.isArray(c.games) ? c.games : [],
            },
          });
          centerIdMap.set(c.id, created.id);
          metrics.newCentersCreated++;
        } else {
          centerIdMap.set(c.id, existing.id);
          // Only update non-destructive metadata if center was originally seeded
          if (c.id === existing.id || c.slug === existing.slug) {
            await prisma.gamingCenter.update({
              where: { id: existing.id },
              data: {
                name: c.name,
                description: existing.description || c.description,
              },
            });
            metrics.centersUpdated++;
          } else {
            metrics.centersUnchanged++;
          }
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed to seed GamingCenter ${c.name} (${c.id}):`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 3. Settings & SiteSettings per Center
  if (Array.isArray(dataset.settings)) {
    for (const s of dataset.settings) {
      const realCenterId = centerIdMap.get(s.gamingCenterId) || s.gamingCenterId;
      try {
        const existingSettings = await prisma.settings.findUnique({
          where: { gamingCenterId: realCenterId },
        });

        if (!existingSettings) {
          await prisma.settings.create({
            data: {
              gamingCenterId: realCenterId,
              preventOverlaps: s.preventOverlaps ?? true,
              allowOnlineBooking: s.allowOnlineBooking ?? true,
              onlineBookingAutoConfirm: false,
              requireOtpForPublicBooking: true,
              maxAdvanceBookingDays: s.maxAdvanceBookingDays ?? 14,
              minAdvanceBookingMinutes: 15,
              cancellationHours: s.cancellationWindowHours ?? 2,
              autoReleaseUnpaidMinutes: 15,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }

        // Also ensure siteSettings exist
        const centerObj = dataset.gamingCenters?.find((gc: { id: string }) => gc.id === s.gamingCenterId);
        const centerName = centerObj?.name || 'مرکز بازی';
        const existingSiteSettings = await prisma.siteSettings.findUnique({
          where: { gamingCenterId: realCenterId },
        });
        if (!existingSiteSettings) {
          await prisma.siteSettings.create({
            data: {
              gamingCenterId: realCenterId,
              defaultSeoTitle: `${centerName} | رزرو آنلاین سیستم و کنسول گیمینگ`,
              defaultSeoDescription: `رزرو آنلاین سیستم‌های PC و کنسول‌های PS5 در ${centerName}`,
              robotsIndex: RobotsIndex.INDEX,
              robotsFollow: RobotsFollow.FOLLOW,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed settings for center ${realCenterId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 4. Commission Policies
  if (Array.isArray(dataset.commissionPolicies)) {
    for (const cp of dataset.commissionPolicies) {
      const realCenterId = centerIdMap.get(cp.gamingCenterId) || cp.gamingCenterId;
      try {
        const existing = await prisma.commissionPolicy.findUnique({
          where: { gamingCenterId: realCenterId },
        });

        if (!existing) {
          await prisma.commissionPolicy.create({
            data: {
              gamingCenterId: realCenterId,
              type: CommissionType.PERCENT,
              percentBps: cp.percentBps ?? 500,
              isActive: true,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed CommissionPolicy for center ${realCenterId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 5. Addresses
  if (Array.isArray(dataset.addresses)) {
    for (const a of dataset.addresses) {
      const realCenterId = centerIdMap.get(a.gamingCenterId) || a.gamingCenterId;
      try {
        const existing = await prisma.address.findFirst({
          where: {
            OR: [
              ...(a.id ? [{ id: a.id }] : []),
              { gamingCenterId: realCenterId, addressLine: a.addressLine },
            ],
          },
        });
        if (!existing) {
          await prisma.address.create({
            data: {
              ...(a.id ? { id: a.id } : {}),
              gamingCenterId: realCenterId,
              city: a.city || 'تبریز',
              province: a.province || 'آذربایجان شرقی',
              district: a.district || '',
              addressLine: a.addressLine || '',
              lat: typeof a.lat === 'number' ? a.lat : null,
              lng: typeof a.lng === 'number' ? a.lng : null,
              isPrimary: a.isPrimary ?? true,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed Address for center ${realCenterId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 6. Social Links
  if (Array.isArray(dataset.socialLinks)) {
    for (const sl of dataset.socialLinks) {
      const realCenterId = centerIdMap.get(sl.gamingCenterId) || sl.gamingCenterId;
      try {
        const linkType = sl.type === 'INSTAGRAM' ? LinkType.INSTAGRAM : LinkType.PHONE;
        const existing = await prisma.socialLink.findFirst({
          where: {
            OR: [
              ...(sl.id ? [{ id: sl.id }] : []),
              { gamingCenterId: realCenterId, type: linkType, value: sl.value },
            ],
          },
        });
        if (!existing) {
          await prisma.socialLink.create({
            data: {
              ...(sl.id ? { id: sl.id } : {}),
              gamingCenterId: realCenterId,
              type: linkType,
              label: linkType === LinkType.INSTAGRAM ? 'اینستاگرام' : 'تلفن تماس',
              value: sl.value,
              isPrimary: true,
              isActive: true,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed SocialLink for center ${realCenterId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 7. Users
  const userIdMap = new Map<string, string>(); // dataset user id -> db user id
  if (Array.isArray(dataset.users)) {
    for (const u of dataset.users) {
      const realCenterId = centerIdMap.get(u.gamingCenterId) || u.gamingCenterId;
      try {
        const existing = await prisma.user.findFirst({
          where: {
            OR: [
              ...(u.id ? [{ id: u.id }] : []),
              { gamingCenterId: realCenterId, phone: u.phone },
            ],
          },
        });

        if (!existing) {
          const role = u.role === 'MANAGER' ? UserRole.MANAGER : UserRole.STAFF;
          const created = await prisma.user.create({
            data: {
              ...(u.id ? { id: u.id } : {}),
              gamingCenterId: realCenterId,
              fullName: u.fullName,
              phone: u.phone,
              role,
              isActive: u.isActive ?? true,
              passwordHash: commonPasswordHash,
            },
          });
          userIdMap.set(u.id, created.id);
          metrics.dependentRecordsCreated++;
        } else {
          userIdMap.set(u.id, existing.id);
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed User ${u.fullName} (${u.phone}):`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 8. Staff Shifts
  if (Array.isArray(dataset.staffShifts)) {
    for (const sh of dataset.staffShifts) {
      const realCenterId = centerIdMap.get(sh.gamingCenterId) || sh.gamingCenterId;
      const realUserId = userIdMap.get(sh.userId) || sh.userId;
      try {
        const existing = await prisma.staffShift.findUnique({
          where: {
            gamingCenterId_userId_dayOfWeek: {
              gamingCenterId: realCenterId,
              userId: realUserId,
              dayOfWeek: sh.dayOfWeek,
            },
          },
        });

        if (!existing) {
          const shiftRole = sh.shiftRole === 'HOST' ? ShiftRole.HOST : ShiftRole.CASHIER;
          await prisma.staffShift.create({
            data: {
              ...(sh.id ? { id: sh.id } : {}),
              gamingCenterId: realCenterId,
              userId: realUserId,
              dayOfWeek: sh.dayOfWeek,
              startTime: sh.startTime,
              endTime: sh.endTime,
              shiftRole,
              isActive: true,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed StaffShift for user ${realUserId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 9. Game Stations
  const stationIdMap = new Map<string, string>(); // dataset station id -> db station id
  if (Array.isArray(dataset.gameStations)) {
    for (const st of dataset.gameStations) {
      const realCenterId = centerIdMap.get(st.gamingCenterId) || st.gamingCenterId;
      try {
        const existing = await prisma.gameStation.findFirst({
          where: {
            OR: [
              ...(st.id ? [{ id: st.id }] : []),
              { gamingCenterId: realCenterId, name: st.name },
            ],
          },
        });

        let stationType: GameStationType = GameStationType.PC;
        if (st.stationType === 'PLAYSTATION') stationType = GameStationType.PLAYSTATION;
        else if (st.stationType === 'XBOX') stationType = GameStationType.XBOX;

        if (!existing) {
          const created = await prisma.gameStation.create({
            data: {
              ...(st.id ? { id: st.id } : {}),
              gamingCenterId: realCenterId,
              name: st.name,
              stationType,
              isVip: st.isVip ?? false,
              hourlyPrice: st.hourlyPrice,
              minRentHours: st.minRentHours ?? 1,
              maxRentHours: st.maxRentHours ?? 6,
              isActive: st.isActive ?? true,
            },
          });
          stationIdMap.set(st.id, created.id);
          metrics.newStationsCreated++;
        } else {
          stationIdMap.set(st.id, existing.id);
          // Only update non-breaking fields if owned
          if (st.id === existing.id || st.name === existing.name) {
            await prisma.gameStation.update({
              where: { id: existing.id },
              data: {
                hourlyPrice: st.hourlyPrice,
                isVip: st.isVip ?? false,
              },
            });
            metrics.stationsUpdated++;
          }
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed GameStation ${st.name}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 10. Customer Accounts
  const customerAccountIdMap = new Map<string, string>();
  if (Array.isArray(dataset.customerAccounts)) {
    for (const ca of dataset.customerAccounts) {
      try {
        const existing = await prisma.customerAccount.findFirst({
          where: {
            OR: [
              ...(ca.id ? [{ id: ca.id }] : []),
              { phone: ca.phone },
            ],
          },
        });

        if (!existing) {
          const created = await prisma.customerAccount.create({
            data: {
              ...(ca.id ? { id: ca.id } : {}),
              phone: ca.phone,
              fullName: ca.fullName || null,
              walletBalance: ca.walletBalance || 0,
              phoneVerifiedAt: new Date(),
            },
          });
          customerAccountIdMap.set(ca.id, created.id);
          metrics.dependentRecordsCreated++;
        } else {
          customerAccountIdMap.set(ca.id, existing.id);
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed CustomerAccount ${ca.phone}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 11. Customer Profiles
  const profileIdMap = new Map<string, string>();
  if (Array.isArray(dataset.customerProfiles)) {
    for (const cp of dataset.customerProfiles) {
      const realCenterId = centerIdMap.get(cp.gamingCenterId) || cp.gamingCenterId;
      const realAccountId = customerAccountIdMap.get(cp.customerAccountId) || cp.customerAccountId;
      try {
        const existing = await prisma.customerProfile.findUnique({
          where: {
            gamingCenterId_customerAccountId: {
              gamingCenterId: realCenterId,
              customerAccountId: realAccountId,
            },
          },
        });

        if (!existing) {
          const profile = await prisma.customerProfile.create({
            data: {
              ...(cp.id ? { id: cp.id } : {}),
              gamingCenterId: realCenterId,
              customerAccountId: realAccountId,
              displayName: cp.displayName || 'مشتری',
            },
          });
          profileIdMap.set(cp.id, profile.id);
          metrics.dependentRecordsCreated++;
        } else {
          profileIdMap.set(cp.id, existing.id);
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed CustomerProfile for account ${realAccountId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 12. Reservations
  const reservationIdMap = new Map<string, string>();
  if (Array.isArray(dataset.reservations)) {
    for (const r of dataset.reservations) {
      const realCenterId = centerIdMap.get(r.gamingCenterId) || r.gamingCenterId;
      const realStationId = stationIdMap.get(r.stationId) || r.stationId;
      const realAccountId = customerAccountIdMap.get(r.customerAccountId) || r.customerAccountId;
      const realProfileId = profileIdMap.get(r.customerProfileId) || r.customerProfileId;
      const realStaffId = userIdMap.get(r.staffId) || r.staffId;
      const realCreatedBy = userIdMap.get(r.createdByUserId) || r.createdByUserId;

      try {
        const existing = await prisma.reservation.findFirst({
          where: {
            OR: [
              ...(r.id ? [{ id: r.id }] : []),
              {
                gamingCenterId: realCenterId,
                stationId: realStationId,
                startTime: new Date(r.startTime),
              },
            ],
          },
        });

        let status: ReservationStatus = ReservationStatus.COMPLETED;
        if (r.status === 'CONFIRMED') status = ReservationStatus.CONFIRMED;
        else if (r.status === 'PENDING') status = ReservationStatus.PENDING;
        else if (r.status === 'CANCELED') status = ReservationStatus.CANCELED;
        else if (r.status === 'NO_SHOW') status = ReservationStatus.NO_SHOW;

        let paymentState: ReservationPaymentState = ReservationPaymentState.PAID;
        if (r.paymentState === 'UNPAID') paymentState = ReservationPaymentState.UNPAID;
        else if (r.paymentState === 'REFUNDED') paymentState = ReservationPaymentState.REFUNDED;

        const source: ReservationSource = r.source === 'WALK_IN' ? ReservationSource.WALK_IN : ReservationSource.ONLINE;

        if (!existing) {
          const created = await prisma.reservation.create({
            data: {
              ...(r.id ? { id: r.id } : {}),
              gamingCenterId: realCenterId,
              stationId: realStationId,
              customerAccountId: realAccountId,
              customerProfileId: realProfileId,
              staffId: realStaffId,
              createdByUserId: realCreatedBy,
              startTime: new Date(r.startTime),
              endTime: new Date(r.endTime),
              totalHours: r.totalHours,
              totalPrice: r.totalPrice,
              discountAmount: r.discountAmount || 0,
              status,
              source,
              paymentState,
              stationSnapshot: r.stationSnapshot || {},
              completedAt: status === ReservationStatus.COMPLETED ? new Date(r.endTime) : null,
              canceledAt: status === ReservationStatus.CANCELED ? new Date(r.startTime) : null,
            },
          });
          reservationIdMap.set(r.id, created.id);
          metrics.dependentRecordsCreated++;
        } else {
          reservationIdMap.set(r.id, existing.id);
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed Reservation ${r.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 13. Gaming Sessions
  if (Array.isArray(dataset.gamingSessions)) {
    for (const gs of dataset.gamingSessions) {
      const realReservationId = reservationIdMap.get(gs.reservationId) || gs.reservationId;
      const realStationId = stationIdMap.get(gs.stationId) || gs.stationId;
      try {
        const existing = await prisma.gamingSession.findFirst({
          where: {
            OR: [
              ...(gs.id ? [{ id: gs.id }] : []),
              { reservationId: realReservationId },
            ],
          },
        });

        if (!existing) {
          await prisma.gamingSession.create({
            data: {
              ...(gs.id ? { id: gs.id } : {}),
              reservationId: realReservationId,
              stationId: realStationId,
              startTime: new Date(gs.startTime),
              endTime: gs.endTime ? new Date(gs.endTime) : null,
              actualHours: gs.actualHours || 0,
              status: GamingSessionStatus.COMPLETED,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed GamingSession for reservation ${realReservationId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 14. Payments, Earnings & Ledger Entries
  if (Array.isArray(dataset.payments)) {
    for (const p of dataset.payments) {
      const realCenterId = centerIdMap.get(p.gamingCenterId) || p.gamingCenterId;
      const realReservationId = reservationIdMap.get(p.reservationId) || p.reservationId;

      try {
        const existing = await prisma.payment.findFirst({
          where: {
            OR: [
              ...(p.id ? [{ id: p.id }] : []),
              { reservationId: realReservationId },
            ],
          },
        });

        let method: PaymentMethod = PaymentMethod.ONLINE;
        if (p.method === 'CASH') method = PaymentMethod.CASH;
        else if (p.method === 'POS') method = PaymentMethod.CARD;
        else if (p.method === 'WALLET') method = PaymentMethod.ONLINE;

        let status: PaymentStatus = PaymentStatus.PAID;
        if (p.status === 'REFUNDED') status = PaymentStatus.REFUNDED;
        else if (p.status === 'FAILED') status = PaymentStatus.FAILED;
        else if (p.status === 'INITIATED') status = PaymentStatus.INITIATED;

        if (!existing) {
          const payment = await prisma.payment.create({
            data: {
              ...(p.id ? { id: p.id } : {}),
              gamingCenterId: realCenterId,
              reservationId: realReservationId,
              amount: p.amount,
              currency: p.currency || 'IRT',
              method,
              provider: method === PaymentMethod.ONLINE ? PaymentProvider.ZARINPAL : PaymentProvider.MANUAL,
              status,
              paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
              referenceCode: `SEED-PAY-${p.id}`,
            },
          });

          // Ledger entry
          await prisma.ledgerEntry.create({
            data: {
              gamingCenterId: realCenterId,
              paymentId: payment.id,
              entryType: LedgerEntryType.PAYMENT_COLLECTION,
              amount: p.amount,
              currency: p.currency || 'IRT',
              idempotencyKey: `LEDGER-PAY-${payment.id}`,
              description: `وصول وجه رزرو ${realReservationId} از طریق Seed`,
              createdAt: p.paidAt ? new Date(p.paidAt) : new Date(),
            },
          });

          // Earning calculation
          const commissionAmount = Math.round(p.amount * 0.05);
          await prisma.earning.create({
            data: {
              reservationId: realReservationId,
              gamingCenterId: realCenterId,
              baseAmount: p.amount,
              currency: p.currency || 'IRT',
              type: CommissionType.PERCENT,
              percentBps: 500,
              commissionAmount,
              status: CommissionStatus.ACCRUED,
              createdAt: p.paidAt ? new Date(p.paidAt) : new Date(),
            },
          });

          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed Payment for reservation ${realReservationId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 15. Ratings
  if (Array.isArray(dataset.ratings)) {
    for (const r of dataset.ratings) {
      const realCenterId = centerIdMap.get(r.gamingCenterId) || r.gamingCenterId;
      const realAccountId = customerAccountIdMap.get(r.customerAccountId) || r.customerAccountId;
      const realReservationId = reservationIdMap.get(r.reservationId) || r.reservationId;

      try {
        const res = await prisma.reservation.findUnique({
          where: { id: realReservationId },
          select: { stationId: true },
        });

        const targetStationId = res?.stationId || null;
        const existing = await prisma.rating.findFirst({
          where: {
            OR: [
              ...(r.id ? [{ id: r.id }] : []),
              {
                reservationId: realReservationId,
                stationId: targetStationId,
              },
            ],
          },
        });

        if (!existing) {
          const score = typeof r.score === 'number' ? r.score : 5;
          await prisma.rating.create({
            data: {
              ...(r.id ? { id: r.id } : {}),
              gamingCenterId: realCenterId,
              customerAccountId: realAccountId,
              reservationId: realReservationId,
              stationId: targetStationId,
              rating: score,
              cleanlinessRating: score,
              equipmentRating: score,
              staffRating: score,
              priceValueRating: score,
              comment: r.comment || null,
              status: RatingStatus.PUBLISHED,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed Rating for reservation ${realReservationId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 16. Tournaments
  if (Array.isArray(dataset.tournaments)) {
    for (const t of dataset.tournaments) {
      const realCenterId = centerIdMap.get(t.gamingCenterId) || t.gamingCenterId;
      try {
        const existing = await prisma.tournament.findFirst({
          where: {
            OR: [
              ...(t.id ? [{ id: t.id }] : []),
              { gamingCenterId: realCenterId, title: t.name },
            ],
          },
        });

        if (!existing) {
          const startsAt = t.startsAt ? new Date(t.startsAt) : new Date();
          await prisma.tournament.create({
            data: {
              ...(t.id ? { id: t.id } : {}),
              gamingCenterId: realCenterId,
              title: t.name,
              gameName: t.game || 'FC 25',
              startTime: startsAt,
              endTime: new Date(startsAt.getTime() + 6 * 3600 * 1000),
              prizePool: t.prizePool ? `${t.prizePool.toLocaleString()} تومان` : '۱,۰۰۰,۰۰۰ تومان',
              maxParticipants: 32,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed Tournament ${t.name}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 17. Pages
  if (Array.isArray(dataset.pages)) {
    for (const p of dataset.pages) {
      const realCenterId = centerIdMap.get(p.gamingCenterId) || p.gamingCenterId;
      try {
        const centerObj = dataset.gamingCenters?.find((gc: { id: string }) => gc.id === p.gamingCenterId);
        const centerSlug = centerObj?.slug || 'center';

        const existing = await prisma.page.findUnique({
          where: {
            gamingCenterId_slug: {
              gamingCenterId: realCenterId,
              slug: p.slug,
            },
          },
        });

        if (!existing) {
          await prisma.page.create({
            data: {
              ...(p.id ? { id: p.id } : {}),
              gamingCenterId: realCenterId,
              slug: p.slug,
              fullPath: `/${centerSlug}/${p.slug}`,
              title: p.title || 'قوانین و مقررات',
              content: p.body || null,
              type: PageType.CUSTOM,
              status: p.published ? PageStatus.PUBLISHED : PageStatus.DRAFT,
              publishedAt: p.published ? new Date() : null,
            },
          });
          metrics.dependentRecordsCreated++;
        } else {
          metrics.duplicateRecordsIdentified++;
        }
      } catch (err) {
        metrics.failedOperationsCount++;
        console.error(`⚠️ Failed Page ${p.slug} for center ${realCenterId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  metrics.elapsedTimeMs = Date.now() - startTime;
  return metrics;
}
