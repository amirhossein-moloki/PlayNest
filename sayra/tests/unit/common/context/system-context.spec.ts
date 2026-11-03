import { describe, it, expect, jest } from '@jest/globals';
import { runWithSystemContext, getRequestContext } from '../../../../src/common/context/request-context';
import { processTenantGuardOperation } from '../../../../src/config/prisma-extensions';
import logger from '../../../../src/config/logger';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

describe('System Context & Tenant Guard Integration', () => {
  it('should run callback with isSystemContext=true and correlationId', async () => {
    let capturedContext: any = null;
    await runWithSystemContext('TestWorker', async () => {
      capturedContext = getRequestContext();
    });

    expect(capturedContext).toBeDefined();
    expect(capturedContext.isSystemContext).toBe(true);
    expect(capturedContext.systemJobName).toBe('TestWorker');
    expect(capturedContext.correlationId).toMatch(/^sys-/);
  });

  it('should log debug and allow query execution when isSystemContext is active', async () => {
    const loggerSpy = jest.spyOn(logger, 'debug').mockImplementation(() => logger as any);
    const mockQuery = jest.fn(() => Promise.resolve([{ id: 'res_1' }]));

    await runWithSystemContext('ReservationExpiryWorker', async () => {
      const result = await processTenantGuardOperation({
        model: 'Reservation',
        operation: 'findMany',
        args: {
          where: {
            status: 'PENDING',
          },
        },
        query: mockQuery,
      });

      expect(result).toEqual([{ id: 'res_1' }]);
      expect(mockQuery).toHaveBeenCalled();
    });

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'Reservation',
        operation: 'findMany',
        systemJobName: 'ReservationExpiryWorker',
      }),
      expect.stringContaining('Authorized cross-tenant system operation executed')
    );

    loggerSpy.mockRestore();
  });

  it('should log warning on tenant-scoped query when isSystemContext is not active and tenant filter is missing', async () => {
    const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger as any);
    const mockQuery = jest.fn(() => Promise.resolve([{ id: 'res_1' }]));

    // Normal execution (e.g. regular HTTP user request missing tenant filter)
    await processTenantGuardOperation({
      model: 'Reservation',
      operation: 'findMany',
      args: {
        where: {
          status: 'PENDING',
        },
      },
      query: mockQuery,
    });

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'Reservation',
        operation: 'findMany',
      }),
      expect.stringContaining('Potential missing gamingCenterId filter on tenant-scoped model')
    );

    loggerWarnSpy.mockRestore();
  });
});
