import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { prisma } from '../../../../src/config/prisma';
import { Settings } from '@prisma/client';

describe('Operations & Reliability Analytics Unit Test Suite', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.settings, 'findUnique').mockResolvedValue({ timeZone: 'Asia/Tehran' } as unknown as Settings);
  });

  describe('1. Job & Pipeline Health — Last Attempt vs Last Successful Run Invariants', () => {
    it('should distinguish last attempt from last successful run and NOT report failed run as successful', async () => {
      const now = new Date();
      const failedAttemptTime = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago
      const earlierSuccessTime = new Date(now.getTime() - 180 * 60 * 1000); // 3 hours ago

      jest.spyOn(AnalyticsRepo, 'getJobsHealthData').mockResolvedValue({
        watermarks: [],
        runs: [
          {
            id: 'run_failed_1',
            entity: 'Reservation',
            status: 'FAILED',
            startedAt: failedAttemptTime,
            completedAt: failedAttemptTime,
            recordsRead: 10,
            recordsIngested: 0,
            durationMs: 50,
            watermarkBefore: earlierSuccessTime,
            watermarkAfter: earlierSuccessTime,
            errorMessage: 'Database connection timeout',
            createdAt: failedAttemptTime,
          },
          {
            id: 'run_success_1',
            entity: 'Reservation',
            status: 'SUCCESS',
            startedAt: earlierSuccessTime,
            completedAt: earlierSuccessTime,
            recordsRead: 100,
            recordsIngested: 100,
            durationMs: 200,
            watermarkBefore: new Date(earlierSuccessTime.getTime() - 60000),
            watermarkAfter: earlierSuccessTime,
            errorMessage: null,
            createdAt: earlierSuccessTime,
          },
        ] as unknown as Awaited<ReturnType<typeof AnalyticsRepo.getJobsHealthData>>['runs'],
        notificationStats: [],
      });

      const result = await AnalyticsStation.getJobsHealth();
      const reservationJob = result.jobs.find((j) => j.entity === 'Reservation');

      expect(reservationJob).toBeDefined();
      expect(reservationJob?.status).toBe('FAILED');
      expect(reservationJob?.lastAttemptAt).toEqual(failedAttemptTime);
      expect(reservationJob?.lastSuccessfulRunAt).toEqual(earlierSuccessTime);
      expect(reservationJob?.lastError).toBe('Database connection timeout');
    });

    it('should return NEVER_RUN status when no job runs exist', async () => {
      jest.spyOn(AnalyticsRepo, 'getJobsHealthData').mockResolvedValue({
        watermarks: [],
        runs: [],
        notificationStats: [],
      });

      const result = await AnalyticsStation.getJobsHealth();
      const tenantJob = result.jobs.find((j) => j.entity === 'Tenant');

      expect(tenantJob?.status).toBe('NEVER_RUN');
      expect(tenantJob?.lastAttemptAt).toBeNull();
      expect(tenantJob?.lastSuccessfulRunAt).toBeNull();
    });

    it('should report STALE status when last successful run exceeds 120 minutes', async () => {
      const staleTime = new Date(Date.now() - 150 * 60 * 1000); // 150 mins ago

      jest.spyOn(AnalyticsRepo, 'getJobsHealthData').mockResolvedValue({
        watermarks: [],
        runs: [
          {
            id: 'run_stale_1',
            entity: 'Payment',
            status: 'SUCCESS',
            startedAt: staleTime,
            completedAt: staleTime,
            recordsRead: 5,
            recordsIngested: 5,
            durationMs: 100,
            watermarkBefore: staleTime,
            watermarkAfter: staleTime,
            errorMessage: null,
            createdAt: staleTime,
          },
        ] as unknown as Awaited<ReturnType<typeof AnalyticsRepo.getJobsHealthData>>['runs'],
        notificationStats: [],
      });

      const result = await AnalyticsStation.getJobsHealth();
      const paymentJob = result.jobs.find((j) => j.entity === 'Payment');

      expect(paymentJob?.status).toBe('STALE');
      expect(paymentJob?.lagSeconds).toBeGreaterThan(120 * 60);
    });
  });

  describe('2. Operational Data Quality Checks & Non-Mutation Invariants', () => {
    it('should execute 8 deterministic data quality checks without mutating database', async () => {
      jest.spyOn(AnalyticsRepo, 'getOperationalDataQualityChecks').mockResolvedValue({
        orphanPayments: [{ id: 'p_1', amount: 50000, currency: 'IRR', createdAt: new Date() }],
        canceledPaidReservations: [],
        inProgressSessions: [],
        duplicateWaitlists: [],
        nullFieldReservations: [],
        currencyInconsistencies: [],
        orphanRatings: [],
        watermarks: [],
      } as unknown as Awaited<ReturnType<typeof AnalyticsRepo.getOperationalDataQualityChecks>>);

      const result = await AnalyticsStation.getDataQuality('gc_test');

      expect(result.summary.totalChecksEvaluated).toBe(8);
      expect(result.checks.find((c) => c.checkId === 'DQ-001')?.status).toBe('FAILED');
      expect(result.checks.find((c) => c.checkId === 'DQ-002')?.status).toBe('PASSED');
      expect(result.qualityScore).toBe(88); // 7/8 passing
      expect(result.nonMutationNotice).toContain('strictly deterministic and read-only');
    });
  });

  describe('3. Customer Support SLA — Open vs Closed Ticket Isolation', () => {
    it('should calculate resolution time STRICTLY for CLOSED tickets and exclude OPEN tickets', async () => {
      const now = new Date();
      const created1 = new Date(now.getTime() - 60 * 60 * 1000); // 60 mins ago
      const closed1 = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins after creation (resolution = 30 min)

      const createdOpen = new Date(now.getTime() - 120 * 60 * 1000); // open for 120 mins

      jest.spyOn(AnalyticsRepo, 'getSupportAnalyticsStats').mockResolvedValue([
        {
          id: 't_closed_1',
          status: 'CLOSED',
          priority: 'HIGH',
          category: 'TECHNICAL',
          createdAt: created1,
          closedAt: closed1,
          messages: [
            {
              id: 'm_1',
              senderType: 'SUPPORT',
              text: 'Investigating issue',
              createdAt: new Date(created1.getTime() + 10 * 60 * 1000), // 10 min first response
            },
          ],
        },
        {
          id: 't_open_1',
          status: 'OPEN',
          priority: 'HIGH',
          category: 'FINANCIAL',
          createdAt: createdOpen,
          closedAt: null,
          messages: [],
        },
      ] as unknown as Awaited<ReturnType<typeof AnalyticsRepo.getSupportAnalyticsStats>>);

      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      const result = await AnalyticsStation.getSupportQuality('gc_test', startDate, endDate);

      expect(result.totalTickets).toBe(2);
      expect(result.statusDistribution.open).toBe(1);
      expect(result.statusDistribution.closed).toBe(1);

      // Resolution time must be 30 min (from t_closed_1 only), ignoring t_open_1
      expect(result.slaMetrics.avgResolutionMinutes).toBe(30);
      expect(result.slaMetrics.avgFirstResponseMinutes).toBe(10);
      expect(result.slaMetrics.openTicketNotice).toContain('calculated strictly for CLOSED tickets');
    });

    it('should protect against negative response/resolution durations', async () => {
      const now = new Date();
      // Out of order timestamp edge case
      const created = now;
      const closedErroneous = new Date(now.getTime() - 5 * 60 * 1000); // 5 min prior

      jest.spyOn(AnalyticsRepo, 'getSupportAnalyticsStats').mockResolvedValue([
        {
          id: 't_neg_1',
          status: 'CLOSED',
          priority: 'MEDIUM',
          category: 'ACCOUNT',
          createdAt: created,
          closedAt: closedErroneous,
          messages: [],
        },
      ] as unknown as Awaited<ReturnType<typeof AnalyticsRepo.getSupportAnalyticsStats>>);

      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      const result = await AnalyticsStation.getSupportQuality('gc_test', startDate, endDate);

      expect(result.slaMetrics.avgResolutionMinutes).toBe(0); // clamped to 0
    });
  });

  describe('4. Sensitive Telemetry & PII Protection Invariants', () => {
    it('should mask phone numbers in system error telemetry samples', async () => {
      const now = new Date();
      jest.spyOn(AnalyticsRepo, 'getSystemErrorsData').mockResolvedValue({
        failedNotifications: [
          {
            id: 'n_err_1',
            type: 'RESERVATION_CONFIRMED',
            channel: 'SMS',
            recipient: '09129876543',
            lastError: 'SMS gateway timeout',
            attempts: 3,
            createdAt: now,
          },
        ],
        failedPayments: [],
        failedRefunds: [],
        auditErrorLogs: [],
      } as unknown as Awaited<ReturnType<typeof AnalyticsRepo.getSystemErrorsData>>);

      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      const result = await AnalyticsStation.getSystemErrors('gc_test', startDate, endDate);

      expect(result.errorCategories.notificationFailures.samples[0].recipient).toBe('0912***6543');
    });
  });

  describe('5. Product Feature Adoption vs Availability', () => {
    it('should distinguish feature availability from feature adoption based on event counts', async () => {
      const now = new Date();
      jest.spyOn(AnalyticsRepo, 'getFeatureAdoptionStats').mockResolvedValue({
        waitlistEntries: [{ id: 'w_1', status: 'CONVERTED', createdAt: now }],
        waitlistOffers: [],
        proposals: [],
        discounts: [],
        groupBookings: [],
        ratings: [],
        notificationLogs: [],
      } as unknown as Awaited<ReturnType<typeof AnalyticsRepo.getFeatureAdoptionStats>>);

      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endDate = now;

      const result = await AnalyticsStation.getFeatureAdoption('gc_test', startDate, endDate);

      const waitlistFeature = result.features.find((f) => f.featureKey === 'RESERVATION_WAITLIST');
      const proposalsFeature = result.features.find((f) => f.featureKey === 'TIME_PROPOSALS');

      expect(waitlistFeature?.adoptionStatus).toBe('ADOPTED');
      expect(proposalsFeature?.adoptionStatus).toBe('LOW_ADOPTION');
      expect(result.adoptionDistinctionNotice).toContain('availability reflects system capability');
    });
  });

  describe('6. Canonical Issue Matrix', () => {
    it('should return canonical Issue -> Source -> Severity -> Owner/Action Matrix', async () => {
      const result = await AnalyticsStation.getIssueMatrix();

      expect(result.matrix).toHaveLength(6);
      expect(result.matrix[0].issueId).toBe('ISS-001');
      expect(result.matrix[0].sourceComponent).toBe('AnalyticsIngestionWorker');
      expect(result.matrix[0].owner).toBe('Analytics Reliability Eng');
    });
  });
});
