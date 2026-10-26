import { ForecastingService } from '../../../../src/modules/analytics/forecasting.service';
import { prisma } from '../../../../src/config/prisma';
import { subDays, addDays } from 'date-fns';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    reservation: {
      findMany: jest.fn(),
    },
    revenueForecastRun: {
      create: jest.fn(),
    },
    settings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: 'Asia/Tehran' }),
    },
  },
}));

describe('Revenue Forecasting Framework', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return INSUFFICIENT_DATA status when historical data has less than 14 days', async () => {
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([
      { startTime: subDays(new Date(), 2), totalPrice: 100000 },
      { startTime: subDays(new Date(), 1), totalPrice: 150000 },
    ]);

    const result = await ForecastingService.generateRevenueForecast({
      gamingCenterId: 'center-1',
      horizonDays: 7,
      startDate: subDays(new Date(), 5), // Only 5 days
      endDate: new Date(),
    });

    expect(result.sufficiencyStatus).toBe('INSUFFICIENT_DATA');
    expect(result.forecastData).toBeNull();
  });

  it('should generate predictions with confidence bounds when sufficient data is present', async () => {
    const endDate = new Date('2025-01-30');
    const startDate = subDays(endDate, 30); // 30 days history

    const mockReservations = [];
    for (let i = 0; i <= 30; i++) {
      const d = addDays(startDate, i);
      mockReservations.push({
        startTime: d,
        totalPrice: 1000000 + (i % 7) * 100000,
      });
    }

    (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);
    (prisma.revenueForecastRun.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'forecast-run-1',
      createdAt: new Date(),
      ...data,
    }));

    const result = await ForecastingService.generateRevenueForecast({
      gamingCenterId: 'center-1',
      horizonDays: 7,
      startDate,
      endDate,
    });

    expect(result.sufficiencyStatus).toBe('SUFFICIENT');
    expect(result.forecastData).toHaveLength(7);
    expect(result.evaluationMetrics.mae).toBeGreaterThanOrEqual(0);
    expect(result.evaluationMetrics.wape).toBeGreaterThanOrEqual(0);

    const firstPoint = result.forecastData![0];
    expect(firstPoint.tag).toBe('FORECAST_PREDICTION');
    expect(firstPoint.lowerBound).toBeLessThanOrEqual(firstPoint.predictedRevenue);
    expect(firstPoint.upperBound).toBeGreaterThanOrEqual(firstPoint.predictedRevenue);
  });
});
