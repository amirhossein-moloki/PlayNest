import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { toMinorUnits } from '../../common/utils/money';
import { resolveTimezoneAndBoundaries } from './analytics.validators';

export type AnalyticsDataState =
  | 'FRESH'
  | 'STALE'
  | 'LAGGING'
  | 'ERROR'
  | 'NO_DATA'
  | 'INCOMPLETE'
  | 'DATA_COLLECTION_MISSING';

export interface KPIContractDefinition {
  metricId: string;
  name: string;
  definition: string;
  unit: 'CURRENCY_MINOR_UNITS' | 'PERCENTAGE' | 'COUNT' | 'HOURS' | 'MINUTES' | 'RATIO';
  sourceTable: string;
  calculationFormula: string;
  allowedFilters: string[];
  aggregationLevel: 'DAY' | 'WEEK' | 'MONTH' | 'PERIOD_TOTAL';
  timezonePolicy: 'CENTER_LOCAL_TIMEZONE';
  includedStatuses: string[];
  freshnessTargetMinutes: number;
  limitations?: string;
  validationMethod: string;
}

/**
 * Validates that a given KPI definition conforms strictly to the central KPI contract standard.
 */
export function validateKPIContract(contract: KPIContractDefinition): boolean {
  if (!contract.metricId || !contract.metricId.startsWith('M-')) {
    throw new AppError('Invalid metricId: Must start with M-', httpStatus.BAD_REQUEST);
  }
  if (!contract.name || !contract.definition || !contract.calculationFormula) {
    throw new AppError('Missing mandatory metadata in KPI contract', httpStatus.BAD_REQUEST);
  }
  if (!contract.allowedFilters.includes('gamingCenterId')) {
    throw new AppError('gamingCenterId must be an allowed filter for tenant isolation', httpStatus.BAD_REQUEST);
  }
  return true;
}

/**
 * Ensures financial values are safely rounded integer minor units (Rials / IRR).
 */
export function formatMonetaryAmount(amount: number): number {
  return toMinorUnits(amount);
}

/**
 * Wraps timezone and date boundary resolution for shared analytics queries.
 */
export async function resolveAnalyticsBoundaries(
  gamingCenterId: string,
  startDateInput: Date,
  endDateInput: Date
) {
  return resolveTimezoneAndBoundaries(gamingCenterId, startDateInput, endDateInput);
}

/**
 * Standard data state formatter to ensure API/UI responses distinguish no-data from zero.
 */
export function wrapAnalyticsResult<T>(
  data: T,
  state: AnalyticsDataState = 'FRESH',
  disclaimer?: string
) {
  return {
    state,
    disclaimer: disclaimer || null,
    data,
  };
}
