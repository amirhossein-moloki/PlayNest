
export const TABRIZ_CENTERS = [
  {
    id: 'gc-1',
    name: 'Kingsland Game Net',
    slug: 'kingsland-game-net',
    district: 'کوچه‌باغ',
    address: 'تبریز، کوچه‌باغ',
    lat: 38.0810,
    lng: 46.2890,
    phone: '0417660896',
    openingTime: '10:00',
    closingTime: '23:59',
    hourlyRate: 60000,
    vipHourlyRate: 90000,
    hasFoodService: true,
    games: ['CS2', 'Valorant', 'Dota2', 'FIFA 24', 'PUBG', 'Fortnite']
  },
  {
    id: 'gc-2',
    name: 'KIYAN Game Palace',
    slug: 'kiyan-game-palace',
    district: 'خیابان امام',
    address: 'تبریز، خیابان امام خمینی',
    phone: '0419725707',
    lat: 38.0732,
    lng: 46.2971,
    hourlyRate: 65000,
    vipHourlyRate: 95000,
    hasFoodService: false,
    games: ['CS2', 'Valorant', 'Warzone', 'Tekken 8', 'FIFA 24']
  },
  {
    id: 'gc-3',
    name: 'Game Net Puzzle',
    slug: 'game-net-puzzle',
    district: 'زعفرانیه',
    address: 'تبریز، زعفرانیه',
    phone: '04133309846',
    lat: 38.0581,
    lng: 46.2832,
    hourlyRate: 55000,
    vipHourlyRate: 85000,
    hasFoodService: false,
    games: ['LoL', 'CS2', 'Valorant', 'PUBG', 'Apex Legends']
  },
  {
    id: 'gc-4',
    name: 'AtariiClub',
    slug: 'atariiclub',
    district: 'ائل‌گلی',
    address: 'تبریز، ائل‌گلی',
    phone: '0412044240',
    lat: 38.0945,
    lng: 46.3201,
    hourlyRate: 70000,
    vipHourlyRate: 100000,
    hasFoodService: false,
    games: ['FIFA 24', 'eFootball', 'Tekken 8', 'MK1']
  },
  {
    id: 'gc-5',
    name: 'Tunnel Game Net',
    slug: 'tunnel-game-net',
    district: 'ساری‌زمین',
    address: 'تبریز، ساری‌زمین',
    phone: '04133374298',
    lat: 38.0602,
    lng: 46.2711,
    hourlyRate: 50000,
    vipHourlyRate: 80000,
    hasFoodService: false,
    games: ['CS2', 'Valorant', 'PUBG', 'GTA V']
  }
];

const createStations = (centerId: string, basePrice: number, vipPrice: number) => {
  const stations = [];
  for (let i = 0; i < 12; i++) {
    const isPc = i < 8;
    const stationIndex = isPc ? i + 1 : i - 7;
    const isVip = (i === 0 || i === 8);
    stations.push({
      id: `st-${centerId}-${i}`,
      gamingCenterId: centerId,
      name: isPc ? `PC-${stationIndex}` : `PS5-${stationIndex}`,
      stationType: isPc ? 'PC' : 'PLAYSTATION',
      isVip,
      hourlyPrice: isVip ? (vipPrice || basePrice * 1.3) : basePrice,
      isActive: true,
      minRentHours: 1,
      maxRentHours: 12,
      defaultDurationHours: 2,
      incrementMinutes: 30,
    });
  }
  return stations;
};

const createStaff = (centerId: string) => {
  return [
    {
      id: `staff-${centerId}-mgr`,
      gamingCenterId: centerId,
      fullName: `Manager of ${centerId}`,
      phone: `0912100000${centerId.split('-')[1]}`,
      role: 'MANAGER',
      isActive: true,
      isPublic: true,
      publicName: 'Manager',
    },
    {
      id: `staff-${centerId}-1`,
      gamingCenterId: centerId,
      fullName: `Staff 1 of ${centerId}`,
      phone: `0912200000${centerId.split('-')[1]}`,
      role: 'STAFF',
      isActive: true,
      isPublic: true,
      publicName: 'Staff 1',
    }
  ];
};

const createCustomers = () => {
  const customers = [];
  for (let i = 1; i <= 10; i++) {
    customers.push({
      id: `cust-${i}`,
      fullName: `Customer ${i}`,
      phone: `0912700000${i}`,
      walletBalance: 100000,
    });
  }
  return customers;
};

const gamingCenters = TABRIZ_CENTERS.map(c => ({
  ...c,
  isActive: true,
  description: 'بزرگترین و مجهزترین مرکز بازی در تبریز با سیستم‌های بروز و محیطی دوستانه.',
  pcCount: 8,
  consoleCount: 4,
  openingTime: c.openingTime || '10:00',
  closingTime: c.closingTime || '23:59',
}));

const stations = TABRIZ_CENTERS.flatMap(c => createStations(c.id, c.hourlyRate, c.vipHourlyRate));
const staff = TABRIZ_CENTERS.flatMap(c => createStaff(c.id));
const customerAccounts = createCustomers();

// Profiles link customers to centers
const customerProfiles = customerAccounts.flatMap(acc => {
  // Each customer has a profile in Kingsland (gc-1) for simplicity in mocks
  return [{
    id: `prof-${acc.id}-gc-1`,
    gamingCenterId: 'gc-1',
    customerAccountId: acc.id,
    displayName: acc.fullName,
  }];
});

const reservations = [
  {
    id: 'res-1',
    gamingCenterId: 'gc-1',
    stationId: 'st-gc-1-0',
    staffId: 'staff-gc-1-1',
    customerAccountId: 'cust-1',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 2 * 3600000).toISOString(),
    status: 'CONFIRMED',
    paymentState: 'PENDING',
    totalHours: 2,
    totalPrice: 120000,
    stationSnapshot: { name: 'PC-1', hourlyPrice: 60000, stationType: 'PC' }
  }
];

export const db = {
  gamingCenters,
  stations,
  staff,
  customerAccounts,
  customerProfiles,
  reservations,
  tickets: [] as any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  ticketMessages: [] as any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  sessions: [] as any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  auditLogs: [] as any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  earnings: [] as any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  siteSettings: TABRIZ_CENTERS.map(c => ({
    gamingCenterId: c.id,
    logoUrl: '',
    faviconUrl: '',
    defaultSeoTitle: `${c.name} | رزرو آنلاین سیستم`,
    defaultSeoDescription: `رزرو آنلاین سیستم‌های گیمینگ و کنسول در ${c.name}`,
    robotsIndex: 'INDEX',
    robotsFollow: 'FOLLOW',
  })),
  settings: TABRIZ_CENTERS.map(c => ({
    id: `sett-${c.id}`,
    gamingCenterId: c.id,
    timeZone: 'Asia/Tehran',
    workStartTime: '10:00',
    workEndTime: '23:59',
    allowOnlineBooking: true,
    onlineBookingAutoConfirm: false,
    preventOverlaps: true,
  })),
  commissionPolicies: TABRIZ_CENTERS.map(c => ({
    id: `pol-${c.id}`,
    gamingCenterId: c.id,
    type: 'PERCENT',
    percentBps: 500,
    isActive: true,
    currency: 'IRT'
  }))
};
