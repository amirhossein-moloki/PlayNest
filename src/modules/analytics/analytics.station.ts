
import { AnalyticsRepo } from './analytics.repo';
import { format } from 'date-fns';

export const AnalyticsStation = {
  async getSummary(gamingCenterId: string, startDate: Date, endDate: Date) {
    const [stats, newCustomers] = await Promise.all([
      AnalyticsRepo.getSummaryStats(gamingCenterId, startDate, endDate),
      AnalyticsRepo.getNewCustomersCount(gamingCenterId, startDate, endDate),
    ]);

    const totalReservations = stats?.totalReservations || 0;
    const completedReservations = stats?.completedReservations || 0;
    const canceledReservations = stats?.canceledReservations || 0;
    const totalRevenue = stats?.revenue || 0;

    const completionRate =
      totalReservations > 0
        ? (completedReservations / (totalReservations - canceledReservations || 1)) * 100
        : 0;

    const averageReservationValue = completedReservations > 0 ? totalRevenue / completedReservations : 0;

    return {
      totalRevenue,
      realizedCash: stats?.realizedCash || 0,
      totalReservations: totalReservations,
      completedReservations: completedReservations,
      canceledReservations: canceledReservations,
      completionRate: Math.round(completionRate * 100) / 100,
      averageReservationValue: Math.round(averageReservationValue),
      newCustomers,
    };
  },

  async getStaffPerformance(gamingCenterId: string, startDate: Date, endDate: Date) {
    const [staffStats, staffList] = await Promise.all([
      AnalyticsRepo.getStaffPerformanceStats(gamingCenterId, startDate, endDate),
      AnalyticsRepo.getStaffDetails(gamingCenterId),
    ]);

    const performance = staffList.map((staff) => {
      const stats = staffStats.find((s) => s.staffId === staff.id) as { revenue?: number; completedReservations?: number; totalRating?: number; ratingCount?: number; _sum?: { revenue?: number; completedReservations?: number; totalRating?: number; ratingCount?: number } } | undefined;
      const revenue = stats?.revenue || stats?._sum?.revenue || 0;
      const completedReservations = stats?.completedReservations || stats?._sum?.completedReservations || 0;
      const totalRating = stats?.totalRating || stats?._sum?.totalRating || 0;
      const ratingCount = stats?.ratingCount || stats?._sum?.ratingCount || 0;

      return {
        staffId: staff.id,
        staffName: staff.fullName,
        reservationCount: completedReservations,
        revenue,
        averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0,
      };
    });

    return performance;
  },

  async getStationPerformance(gamingCenterId: string, startDate: Date, endDate: Date) {
    const [stationStats, stationsList] = await Promise.all([
      AnalyticsRepo.getStationPerformanceStats(gamingCenterId, startDate, endDate),
      AnalyticsRepo.getStationDetails(gamingCenterId),
    ]);

    const performance = stationsList.map((station) => {
      const stats = stationStats.find((s) => s.stationId === station.id) as { revenue?: number; completedReservations?: number; _sum?: { revenue?: number; completedReservations?: number } } | undefined;
      const revenue = stats?.revenue || stats?._sum?.revenue || 0;
      const completedReservations = stats?.completedReservations || stats?._sum?.completedReservations || 0;

      return {
        stationId: station.id,
        stationName: station.name,
        reservationCount: completedReservations,
        revenue,
      };
    });

    return performance;
  },

  async getRevenueChart(gamingCenterId: string, startDate: Date, endDate: Date) {
    const dailyStats = await AnalyticsRepo.getDailyRevenue(gamingCenterId, startDate, endDate);

    return dailyStats.map((s) => ({
      date: format(s.date, 'yyyy-MM-dd'),
      revenue: s.revenue,
    }));
  },
};
