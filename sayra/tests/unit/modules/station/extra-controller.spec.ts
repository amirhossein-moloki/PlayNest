import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BookingHoldStatus, ReservationStatus } from '@prisma/client';
import {
  addStationExtraController,
  deleteStationExtraController,
  getReservedControllerQuantity,
  getStationExtraControllers,
  isExtraControllerSupportedForStation,
  replaceStationExtraControllers,
  updateStationExtraController,
  validateAndPriceExtraControllers,
} from '../../../../src/modules/station/extra-controller.service';
import { createDeviceTypeSchema, updateDeviceTypeSchema } from '../../../../src/modules/catalog/catalog.validator';
import AppError from '../../../../src/common/errors/AppError';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Extra Controller Management System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Admin DeviceType extraControllerEnabled configuration', () => {
    it('should validate extraControllerEnabled on create and update DeviceType schemas', () => {
      const created = createDeviceTypeSchema.parse({
        body: { name: 'PS5', category: 'PLAYSTATION 5', extraControllerEnabled: true },
      });
      expect(created.body.extraControllerEnabled).toBe(true);

      const updated = updateDeviceTypeSchema.parse({
        params: { id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        body: { extraControllerEnabled: false },
      });
      expect(updated.body.extraControllerEnabled).toBe(false);
    });

    it('should detect DeviceType extraControllerEnabled via deviceTypeRef or catalogDevice', async () => {
      const mockClient = {
        gameStation: {
          findUnique: jest
            .fn<(...args: any[]) => Promise<any>>()
            .mockResolvedValueOnce({
              stationType: 'PLAYSTATION_5',
              deviceTypeId: 'dt-ps5',
              deviceTypeRef: { extraControllerEnabled: true },
              catalogDevice: null,
            })
            .mockResolvedValueOnce({
              stationType: 'PC',
              deviceTypeId: 'dt-pc',
              deviceTypeRef: { extraControllerEnabled: false },
              catalogDevice: null,
            }),
        },
        deviceType: {
          findFirst: jest.fn<(...args: any[]) => Promise<any>>(),
        },
      };

      expect(await isExtraControllerSupportedForStation('st-ps5', mockClient as any)).toBe(true);
      expect(await isExtraControllerSupportedForStation('st-pc', mockClient as any)).toBe(false);
    });
  });

  describe('2. Manager Extra Controller CRUD & DeviceType Guard', () => {
    it('should reject extra controller configuration when DeviceType has extraControllerEnabled=false', async () => {
      const mockClient = {
        gameStation: {
          findFirst: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: 'st-pc' }),
          findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            stationType: 'PC',
            deviceTypeId: 'dt-pc',
            deviceTypeRef: { extraControllerEnabled: false },
            catalogDevice: null,
          }),
        },
        deviceType: { findFirst: jest.fn<(...args: any[]) => Promise<any>>() },
        stationExtraController: {
          deleteMany: jest.fn<(...args: any[]) => Promise<any>>(),
          create: jest.fn<(...args: any[]) => Promise<any>>(),
        },
      };

      await expect(
        replaceStationExtraControllers(
          'st-pc',
          'gc-1',
          [{ controllerType: 'PS5 Controller', quantity: 2, hourlyPrice: 50000 }],
          mockClient as any
        )
      ).rejects.toThrow(AppError);
      expect(mockClient.stationExtraController.create).not.toHaveBeenCalled();
    });

    it('should allow replacing multiple extra controller types when DeviceType is enabled', async () => {
      const mockClient = {
        gameStation: {
          findFirst: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: 'st-ps5' }),
          findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            stationType: 'PLAYSTATION_5',
            deviceTypeId: 'dt-ps5',
            deviceTypeRef: { extraControllerEnabled: true },
            catalogDevice: null,
          }),
        },
        stationExtraController: {
          deleteMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ count: 0 }),
          create: jest
            .fn<(...args: any[]) => Promise<any>>()
            .mockImplementation(async ({ data }: any) => ({ id: `ec-${data.controllerType}`, ...data })),
        },
      };

      const result = await replaceStationExtraControllers(
        'st-ps5',
        'gc-1',
        [
          { controllerType: 'PS4 Controller', quantity: 2, hourlyPrice: 50000 },
          { controllerType: 'PS5 Controller', quantity: 1, hourlyPrice: 70000 },
          { controllerType: 'Xbox Controller', quantity: 3, hourlyPrice: 40000 },
        ],
        mockClient as any
      );

      expect(result).toHaveLength(3);
      expect(mockClient.stationExtraController.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('3. User Panel Visibility & Live Availability', () => {
    it('should return empty array when DeviceType does not support extra controllers', async () => {
      const mockClient = {
        gameStation: {
          findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            stationType: 'PC',
            deviceTypeId: 'dt-pc',
            deviceTypeRef: { extraControllerEnabled: false },
            catalogDevice: null,
          }),
        },
        stationExtraController: { findMany: jest.fn<(...args: any[]) => Promise<any>>() },
      };

      const items = await getStationExtraControllers('st-pc', { activeOnly: true }, mockClient as any);
      expect(items).toEqual([]);
      expect(mockClient.stationExtraController.findMany).not.toHaveBeenCalled();
    });

    it('should compute availableQuantity subtracting active reservations and active holds', async () => {
      const startTime = new Date('2026-12-01T14:00:00.000Z');
      const endTime = new Date('2026-12-01T17:00:00.000Z');

      const mockClient = {
        gameStation: {
          findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            stationType: 'PLAYSTATION_5',
            deviceTypeId: 'dt-ps5',
            deviceTypeRef: { extraControllerEnabled: true },
            catalogDevice: null,
          }),
        },
        stationExtraController: {
          findMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([
            { id: 'ec-1', controllerType: 'PS5 Controller', quantity: 3, hourlyPrice: 50000, isActive: true },
            { id: 'ec-2', controllerType: 'PS4 Controller', quantity: 1, hourlyPrice: 40000, isActive: true },
          ]),
        },
        reservationExtraController: {
          aggregate: jest
            .fn<(...args: any[]) => Promise<any>>()
            .mockResolvedValueOnce({ _sum: { quantity: 1 } }) // ec-1 has 1 reserved
            .mockResolvedValueOnce({ _sum: { quantity: 1 } }), // ec-2 has 1 reserved (0 left -> hidden)
        },
        bookingHoldExtraController: {
          aggregate: jest
            .fn<(...args: any[]) => Promise<any>>()
            .mockResolvedValue({ _sum: { quantity: 0 } }),
        },
      };

      const items = await getStationExtraControllers(
        'st-ps5',
        { startTime, endTime, activeOnly: true },
        mockClient as any
      );

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('ec-1');
      expect(items[0].availableQuantity).toBe(2);
    });
  });

  describe('4, 5, 6. Pricing Calculation, Inventory Protection & Snapshot', () => {
    const startTime = new Date('2026-12-01T14:00:00.000Z');
    const endTime = new Date('2026-12-01T17:00:00.000Z');
    const durationHours = 3;

    it('should calculate exact totalCost = quantity * hourlyPrice * durationHours and snapshot price', async () => {
      const mockClient = {
        gameStation: {
          findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            stationType: 'PLAYSTATION_5',
            deviceTypeId: 'dt-ps5',
            deviceTypeRef: { extraControllerEnabled: true },
            catalogDevice: null,
          }),
        },
        stationExtraController: {
          findFirst: jest
            .fn<(...args: any[]) => Promise<any>>()
            .mockResolvedValueOnce({
              id: 'ec-ps4',
              stationId: 'st-1',
              controllerType: 'PS4 Controller',
              quantity: 4,
              hourlyPrice: 50000,
              isActive: true,
            })
            .mockResolvedValueOnce({
              id: 'ec-ps5',
              stationId: 'st-1',
              controllerType: 'PS5 Controller',
              quantity: 2,
              hourlyPrice: 70000,
              isActive: true,
            }),
        },
        reservationExtraController: {
          aggregate: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ _sum: { quantity: 0 } }),
        },
        bookingHoldExtraController: {
          aggregate: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ _sum: { quantity: 0 } }),
        },
      };

      const result = await validateAndPriceExtraControllers(
        'st-1',
        startTime,
        endTime,
        durationHours,
        [
          { extraControllerId: 'ec-ps4', quantity: 2 },
          { extraControllerId: 'ec-ps5', quantity: 1 },
        ],
        mockClient as any
      );

      // 2 * 50,000 * 3 = 300,000; 1 * 70,000 * 3 = 210,000; total = 510,000
      expect(result.totalCost).toBe(510000);
      expect(result.items).toEqual([
        {
          extraControllerId: 'ec-ps4',
          controllerType: 'PS4 Controller',
          quantity: 2,
          hourlyPrice: 50000,
          totalCost: 300000,
        },
        {
          extraControllerId: 'ec-ps5',
          controllerType: 'PS5 Controller',
          quantity: 1,
          hourlyPrice: 70000,
          totalCost: 210000,
        },
      ]);
    });

    it('should reject when requested quantity exceeds remaining available inventory', async () => {
      const mockClient = {
        gameStation: {
          findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            stationType: 'PLAYSTATION_5',
            deviceTypeId: 'dt-ps5',
            deviceTypeRef: { extraControllerEnabled: true },
            catalogDevice: null,
          }),
        },
        stationExtraController: {
          findFirst: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            id: 'ec-ps4',
            stationId: 'st-1',
            controllerType: 'PS4 Controller',
            quantity: 3,
            hourlyPrice: 50000,
            isActive: true,
          }),
        },
        reservationExtraController: {
          aggregate: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ _sum: { quantity: 2 } }),
        },
        bookingHoldExtraController: {
          aggregate: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ _sum: { quantity: 0 } }),
        },
      };

      await expect(
        validateAndPriceExtraControllers(
          'st-1',
          startTime,
          endTime,
          durationHours,
          [{ extraControllerId: 'ec-ps4', quantity: 2 }], // only 1 remaining!
          mockClient as any
        )
      ).rejects.toThrow(AppError);
    });

    it('should reject zero or negative quantities', async () => {
      const mockClient = {
        gameStation: {
          findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            stationType: 'PLAYSTATION_5',
            deviceTypeId: 'dt-ps5',
            deviceTypeRef: { extraControllerEnabled: true },
            catalogDevice: null,
          }),
        },
      };

      await expect(
        validateAndPriceExtraControllers(
          'st-1',
          startTime,
          endTime,
          durationHours,
          [{ extraControllerId: 'ec-ps4', quantity: -1 }],
          mockClient as any
        )
      ).rejects.toThrow(AppError);
    });

    it('should exclude cancelled/expired reservations and expired holds when counting reserved inventory', async () => {
      const mockClient = {
        reservationExtraController: {
          aggregate: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ _sum: { quantity: 1 } }),
        },
        bookingHoldExtraController: {
          aggregate: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ _sum: { quantity: 1 } }),
        },
      };

      const reserved = await getReservedControllerQuantity('ec-1', startTime, endTime, mockClient as any);
      expect(reserved).toBe(2);

      expect(mockClient.reservationExtraController.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reservation: expect.objectContaining({
              status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.IN_PROGRESS] },
            }),
          }),
        })
      );
      expect(mockClient.bookingHoldExtraController.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bookingHoldItem: expect.objectContaining({
              bookingHold: expect.objectContaining({
                status: BookingHoldStatus.ACTIVE,
              }),
            }),
          }),
        })
      );
    });
  });

  // Unused imports check guard for CRUD functions exported
  it('exports manager CRUD helpers', () => {
    expect(typeof addStationExtraController).toBe('function');
    expect(typeof updateStationExtraController).toBe('function');
    expect(typeof deleteStationExtraController).toBe('function');
  });
});
