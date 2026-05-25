import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';

describe('GET /public/gamingCenters/:salonSlug/availability/slots', () => {
  let gamingCenter: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let station: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let staff: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let testDate: Date; // A fixed Monday for testing

  beforeAll(async () => {
    // Find the next Monday to ensure the test is stable
    const today = new Date();
    testDate = new Date(today);
    testDate.setHours(0, 0, 0, 0); // Start of the day
    // In JS, Sunday is 0, Monday is 1. Prisma schema uses Int. This is consistent.
    while (testDate.getDay() !== 1) {
      testDate.setDate(testDate.getDate() + 1);
    }

    // 1. Create GamingCenter
    gamingCenter = await prisma.gamingCenter.create({
      data: {
        name: 'Test GamingCenter for Availability',
        slug: `test-gamingCenter-avail-${Date.now()}`,
      },
    });

    // 2. Create Staff Member
    staff = await prisma.user.create({
      data: {
        gamingCenterId: gamingCenter.id,
        fullName: 'Available Staff',
        phone: `+2${Date.now()}`,
        role: 'STAFF',
      },
    });

    // 3. Create GameStation and link it to the staff
    station = await prisma.gameStation.create({
      data: {
        gamingCenterId: gamingCenter.id,
        name: 'Availability Test GameStation',
        durationMinutes: 60,
        price: 100,
        currency: 'USD',
        userServices: {
          create: {
            userId: staff.id,
          },
        },
      },
    });

    // 4. Create a StaffShift for the staff on Monday (dayOfWeek = 1)
    await prisma.staffShift.create({
      data: {
        userId: staff.id,
        gamingCenterId: gamingCenter.id,
        dayOfWeek: 1, // Monday
        startTime: '09:00:00',
        endTime: '17:00:00',
        isActive: true,
      },
    });

    // 5. Create a Reservation that blocks a part of the staffShift (11:00 to 12:00)
    const customer = await prisma.customerAccount.create({ data: { phone: `+3${Date.now()}` } });
    const customerProfile = await prisma.customerProfile.create({
      data: { gamingCenterId: gamingCenter.id, customerAccountId: customer.id },
    });
    const creator = await prisma.user.create({
      data: { gamingCenterId: gamingCenter.id, fullName: 'Reservation Creator', phone: `+4${Date.now()}`, role: 'MANAGER' }
    });

    await prisma.reservation.create({
      data: {
        gamingCenterId: gamingCenter.id,
        staffId: staff.id,
        stationId: station.id,
        customerProfileId: customerProfile.id,
        customerAccountId: customer.id,
        createdByUserId: creator.id,
        startTime: new Date(new Date(testDate).setHours(11, 0, 0, 0)),
        endTime: new Date(new Date(testDate).setHours(12, 0, 0, 0)),
        (stationSnapshot as any): station.name,
        (stationSnapshot as any): station.durationMinutes,
        (stationSnapshot as any): station.price,
        (stationSnapshot as any): station.currency,
        totalPrice: station.price,
      }
    });
  });

  afterAll(async () => {
    // Clean up in reverse order of creation
    await prisma.$transaction([
      prisma.reservation.deleteMany({ where: { gamingCenterId: gamingCenter.id } }),
      prisma.customerProfile.deleteMany({ where: { gamingCenterId: gamingCenter.id } }),
      prisma.userService.deleteMany({ where: { stationId: station.id } }),
      prisma.staffShift.deleteMany({ where: { gamingCenterId: gamingCenter.id } }),
    ]);

    await prisma.gameStation.delete({ where: { id: station.id } });
    await prisma.user.deleteMany({ where: { gamingCenterId: gamingCenter.id } });
    await prisma.customerAccount.deleteMany({});
    await prisma.gamingCenter.delete({ where: { id: gamingCenter.id } });
    await prisma.$disconnect();
  });

  it('should return available slots, excluding the booked slot and overlapping slots', async () => {
    const startDate = new Date(testDate);
    const endDate = new Date(new Date(testDate).setHours(23, 59, 59, 999));

    const response = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/availability/slots`)
      .query({
        stationId: station.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const returnedTimes = response.body.data.map((s: any) => new Date(s.time).getTime()); // eslint-disable-line @typescript-eslint/no-explicit-any

    const ten = new Date(new Date(testDate).setHours(10, 0, 0, 0)).getTime();
    const tenFifteen = new Date(new Date(testDate).setHours(10, 15, 0, 0)).getTime(); // Overlaps
    const eleven = new Date(new Date(testDate).setHours(11, 0, 0, 0)).getTime(); // Booked
    const twelve = new Date(new Date(testDate).setHours(12, 0, 0, 0)).getTime();

    expect(returnedTimes).toContain(ten);
    expect(returnedTimes).not.toContain(tenFifteen);
    expect(returnedTimes).not.toContain(eleven);
    expect(returnedTimes).toContain(twelve);

    // Also check the staff info in the response
    expect(response.body.data[0].staff).toEqual({
      id: staff.id,
      fullName: staff.fullName,
    });
  });
});
