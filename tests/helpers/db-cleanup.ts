import { prisma } from '../../src/config/prisma';

export async function cleanupDatabase() {
  const pm = prisma as any;
  try {
      await pm.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
      const tables = [
        'AuditLog', 'Payment', 'EarningPayment', 'Earning', 'Rating',
        'WalletTransaction', 'GamingSession', 'Reservation', 'StaffShift',
        'StaffStationSkill', 'GameStation', 'User', 'CustomerProfile',
        'CustomerAccount', 'GamingCenter', 'Session'
      ];
      for (const table of tables) {
          const modelName = table.charAt(0).toLowerCase() + table.slice(1);
          if (pm[modelName]) await pm[modelName].deleteMany();
      }
  } catch (e) {
      // Ignore cleanup errors in non-SQLite environments
  } finally {
      try { await pm.$executeRawUnsafe('PRAGMA foreign_keys = ON;'); } catch(e) {}
  }
}
