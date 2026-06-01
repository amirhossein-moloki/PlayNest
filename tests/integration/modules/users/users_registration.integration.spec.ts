/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createStaffMember } from '../../../../src/modules/users/users.station';
import * as userRepo from '../../../../src/modules/users/users.repo';
import { auditService } from '../../../../src/modules/audit/audit.station';
import { SessionActorType, UserRole } from '@prisma/client';
import { UserFactory } from '../../../../tests/factories/user.factory';

jest.mock('../../../../src/modules/users/users.repo');
jest.mock('../../../../src/modules/audit/audit.station');

const MockedUserRepo = userRepo as jest.Mocked<typeof userRepo>;
const MockedAuditService = auditService as jest.Mocked<typeof auditService>;

describe('User Registration Integration (Mocked Repo)', () => {
  const gamingCenterId = 'gc-123';
  const actor = { id: 'admin-1', actorType: SessionActorType.USER };
  const context = { ip: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully create a staff member and record audit log', async () => {
    const input = {
      fullName: 'John Doe',
      phone: '09123456789',
      role: UserRole.STAFF,
    };

    const createdUser = UserFactory.create({ ...input, gamingCenterId });
    MockedUserRepo.createUser.mockResolvedValue(createdUser as any);

    const result = await createStaffMember(gamingCenterId, input as any, actor, context);

    expect(result).toEqual(createdUser);
    expect(MockedUserRepo.createUser).toHaveBeenCalledWith(gamingCenterId, input);
    expect(MockedAuditService.recordLog).toHaveBeenCalledWith({
      gamingCenterId,
      userId: actor.id,
      actorType: actor.actorType,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: createdUser.id,
      newData: createdUser,
      ipAddress: context.ip,
      userAgent: context.userAgent,
    });
  });

  it('should fail if repository throws an error (e.g. duplicate)', async () => {
    const input = {
      fullName: 'Duplicate User',
      phone: '09123456789',
      role: UserRole.STAFF,
    };

    const error = new Error('Unique constraint failed');
    MockedUserRepo.createUser.mockRejectedValue(error);

    await expect(createStaffMember(gamingCenterId, input as any, actor, context))
      .rejects.toThrow('Unique constraint failed');

    expect(MockedAuditService.recordLog).not.toHaveBeenCalled();
  });

  it('should reject invalid input (validation error simulated)', async () => {
    // In real scenario, 'validate' middleware handles this, but here we test the station's resilience if it had its own checks
    // Currently users.station.ts doesn't have explicit validation, it relies on Zod middleware
    // But we can simulate if repo fails due to validation
    const error = new Error('Validation failed');
    MockedUserRepo.createUser.mockRejectedValue(error);

    await expect(createStaffMember(gamingCenterId, {} as any, actor))
      .rejects.toThrow('Validation failed');
  });
});
