import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { AuditRepo } from '../../../../src/modules/audit/audit.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AuditRepo', () => {
  const auditMock = prismaMock.auditLog as any;

  it('createLog', async () => {
    auditMock.create.mockResolvedValue({ id: 'l-1' });
    await AuditRepo.createLog({ action: 'test', entity: 'test', entityId: '1' } as any);
    expect(auditMock.create).toHaveBeenCalled();
  });

  it('findManyLogs', async () => {
    auditMock.findMany.mockResolvedValue([]);
    await AuditRepo.findManyLogs({}, 0, 10);
    expect(auditMock.findMany).toHaveBeenCalled();
  });

  it('countLogs', async () => {
    auditMock.count.mockResolvedValue(0);
    await AuditRepo.countLogs({});
    expect(auditMock.count).toHaveBeenCalled();
  });
});
