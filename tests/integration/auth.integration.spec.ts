import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';
import { AuthService } from '../../src/modules/auth/auth.station';
import { prisma } from '../../src/config/prisma';
import { cleanupDatabase } from '../helpers/db-cleanup';
import { auditService } from '../../src/modules/audit/audit.station';
import { createStaffMember } from '../../src/modules/users/users.station';

jest.mock('../../src/modules/audit/audit.station', () => ({
  auditService: { recordLog: jest.fn().mockResolvedValue({}), log: jest.fn().mockResolvedValue({}) },
}));

describe('Auth & User Registration Integration', () => {
  beforeEach(async () => { await cleanupDatabase(); jest.clearAllMocks(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('should create a new customer account if it does not exist', async () => {
    const phone = '09123456789';
    const result = await AuthService.loginCustomer(phone);
    const customerInDb = await prisma.customerAccount.findUnique({ where: { phone } });
    expect(customerInDb).toBeDefined();
    expect(customerInDb?.phone).toBe(phone);
  });

  it('should create a staff member and record an audit log', async () => {
    const gamingCenter = await prisma.gamingCenter.create({ data: { name: 'GC 1', slug: 'gc-1' } });
    const actorUser = await prisma.user.create({ data: { fullName: 'Admin', phone: '0900', gamingCenterId: gamingCenter.id, role: 'MANAGER' } });
    const actor = { id: actorUser.id, actorType: 'USER' as any };
    const userInput = { fullName: 'New Staff', phone: '0901', role: 'STAFF' as any };
    const result = await createStaffMember(gamingCenter.id, userInput, actor);
    const userInDb = await prisma.user.findFirst({ where: { phone: '0901', gamingCenterId: gamingCenter.id } });
    expect(userInDb).toBeDefined();
    expect(auditService.recordLog).toHaveBeenCalled();
  });
});
