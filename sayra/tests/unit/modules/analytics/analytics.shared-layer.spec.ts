import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  validateKPIContract,
  formatMonetaryAmount,
  wrapAnalyticsResult,
  KPIContractDefinition,
} from '../../../../src/modules/analytics/analytics.shared';
import AppError from '../../../../src/common/errors/AppError';

describe('Shared Analytics Layer Infrastructure (analytics.shared.ts)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateKPIContract', () => {
    it('should validate a compliant KPI contract definition', () => {
      const validContract: KPIContractDefinition = {
        metricId: 'M-FIN-001',
        name: 'Completed Booking Value',
        definition: 'Total monetary value of completed reservations',
        unit: 'CURRENCY_MINOR_UNITS',
        sourceTable: 'AnalyticsReservation',
        calculationFormula: 'SUM(totalPrice) WHERE status = COMPLETED',
        allowedFilters: ['gamingCenterId', 'startDate', 'endDate'],
        aggregationLevel: 'PERIOD_TOTAL',
        timezonePolicy: 'CENTER_LOCAL_TIMEZONE',
        includedStatuses: ['COMPLETED'],
        freshnessTargetMinutes: 120,
        validationMethod: 'unit_test',
      };

      expect(validateKPIContract(validContract)).toBe(true);
    });

    it('should throw HTTP 400 AppError when metricId does not start with M-', () => {
      const invalidContract: KPIContractDefinition = {
        metricId: 'FIN-001',
        name: 'Invalid Metric',
        definition: 'Test',
        unit: 'COUNT',
        sourceTable: 'Reservation',
        calculationFormula: 'COUNT(*)',
        allowedFilters: ['gamingCenterId'],
        aggregationLevel: 'DAY',
        timezonePolicy: 'CENTER_LOCAL_TIMEZONE',
        includedStatuses: [],
        freshnessTargetMinutes: 60,
        validationMethod: 'unit_test',
      };

      expect(() => validateKPIContract(invalidContract)).toThrow(AppError);
    });

    it('should throw HTTP 400 AppError when gamingCenterId is missing from allowed filters', () => {
      const missingTenantFilterContract: KPIContractDefinition = {
        metricId: 'M-RES-001',
        name: 'Bookings Created',
        definition: 'Count of bookings created',
        unit: 'COUNT',
        sourceTable: 'Reservation',
        calculationFormula: 'COUNT(id)',
        allowedFilters: ['startDate', 'endDate'], // Missing gamingCenterId!
        aggregationLevel: 'DAY',
        timezonePolicy: 'CENTER_LOCAL_TIMEZONE',
        includedStatuses: ['CONFIRMED'],
        freshnessTargetMinutes: 60,
        validationMethod: 'unit_test',
      };

      expect(() => validateKPIContract(missingTenantFilterContract)).toThrow(AppError);
    });
  });

  describe('formatMonetaryAmount', () => {
    it('should safely round floating-point financial values to integer minor units', () => {
      expect(formatMonetaryAmount(100.4)).toBe(100);
      expect(formatMonetaryAmount(100.5)).toBe(101);
      expect(formatMonetaryAmount(0.1 + 0.2)).toBe(0);
    });
  });

  describe('wrapAnalyticsResult', () => {
    it('should format analytics response with explicit data state indicator', () => {
      const payload = { totalRevenue: 500000 };
      const wrapped = wrapAnalyticsResult(payload, 'FRESH');

      expect(wrapped.state).toBe('FRESH');
      expect(wrapped.disclaimer).toBeNull();
      expect(wrapped.data).toEqual(payload);
    });

    it('should handle NO_DATA and DATA_COLLECTION_MISSING states with disclaimers', () => {
      const wrapped = wrapAnalyticsResult(
        null,
        'DATA_COLLECTION_MISSING',
        'Operating expenses are not recorded in the database.'
      );

      expect(wrapped.state).toBe('DATA_COLLECTION_MISSING');
      expect(wrapped.disclaimer).toBe('Operating expenses are not recorded in the database.');
      expect(wrapped.data).toBeNull();
    });
  });
});
