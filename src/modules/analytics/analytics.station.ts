
import { AnalyticsRepo } from './analytics.repo';
import { format } from 'date-fns';

export const AnalyticsService = {
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

    const averageBookingValue = completedReservations > 0 ? totalRevenue / completedReservations : 0;

    return {
      totalRevenue,
      realizedCash: stats?.realizedCash || 0,
      totalBookings: totalReservations,
      completedBookings: completedReservations,
      canceledBookings: canceledReservations,
      completionRate: Math.round(completionRate * 100) / 100,
      averageBookingValue: Math.round(averageBookingValue),
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
        bookingsCount: completedReservations,
        revenue,
        averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0,
      };
    });

    return performance;
  },

  async getServicePerformance(gamingCenterId: string, startDate: Date, endDate: Date) {
    const [serviceStats, servicesList] = await Promise.all([
      AnalyticsRepo.getServicePerformanceStats(gamingCenterId, startDate, endDate),
      AnalyticsRepo.getServiceDetails(gamingCenterId),
    ]);

    const performance = servicesList.map((station) => {
      const stats = serviceStats.find((s) => s.stationId === station.id) as { revenue?: number; completedReservations?: number; _sum?: { revenue?: number; completedReservations?: number } } | undefined;
      const revenue = stats?.revenue || stats?._sum?.revenue || 0;
      const completedReservations = stats?.completedReservations || stats?._sum?.completedReservations || 0;

      return {
        stationId: station.id,
        serviceName: station.name,
        bookingsCount: completedReservations,
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
