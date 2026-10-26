import { EventsCollector } from '../../../../src/modules/analytics/events.collector';
import { prisma } from '../../../../src/config/prisma';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    analyticsEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    reservation: {
      findUnique: jest.fn(),
    },
  },
}));

describe('EventsCollector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should collect a valid page_view event', async () => {
    (prisma.analyticsEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.analyticsEvent.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'event-123',
      ...data,
    }));

    const result = await EventsCollector.collectEvent({
      eventType: 'page_view',
      visitorId: 'visitor-1',
      sessionId: 'session-1',
      pagePath: '/home',
      gamingCenterId: 'center-1',
    });

    expect(result.status).toBe('COLLECTED');
    expect(result.eventId).toBe('event-123');
    expect(prisma.analyticsEvent.create).toHaveBeenCalledTimes(1);
  });

  it('should ignore duplicate event when deduplicationKey exists', async () => {
    (prisma.analyticsEvent.findUnique as jest.Mock).mockResolvedValue({
      id: 'event-existing',
      eventType: 'page_view',
    });

    const result = await EventsCollector.collectEvent({
      eventType: 'page_view',
      visitorId: 'visitor-1',
      sessionId: 'session-1',
      deduplicationKey: 'dedup-key-1',
    });

    expect(result.status).toBe('DUPLICATE_IGNORED');
    expect(result.eventId).toBe('event-existing');
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('should sanitize sensitive keys from payload', async () => {
    (prisma.analyticsEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.analyticsEvent.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'event-456',
      ...data,
    }));

    await EventsCollector.collectEvent({
      eventType: 'booking_started',
      visitorId: 'visitor-2',
      sessionId: 'session-2',
      payload: {
        stationType: 'PC',
        password: 'secretPassword123',
        creditCard: '1234-5678-9012-3456',
      },
    });

    const createCall = (prisma.analyticsEvent.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.payload.stationType).toBe('PC');
    expect(createCall.data.payload.password).toBe('[REDACTED_SENSITIVE]');
    expect(createCall.data.payload.creditCard).toBe('[REDACTED_SENSITIVE]');
  });

  it('should verify payment_succeeded against server reservation DB state', async () => {
    (prisma.analyticsEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.reservation.findUnique as jest.Mock).mockResolvedValue({
      paymentState: 'PAID',
      status: 'CONFIRMED',
    });
    (prisma.analyticsEvent.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'event-789',
      ...data,
    }));

    await EventsCollector.collectEvent({
      eventType: 'payment_succeeded',
      visitorId: 'visitor-3',
      sessionId: 'session-3',
      reservationId: 'res-1',
    });

    const createCall = (prisma.analyticsEvent.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.payload._serverVerified).toBe(true);
    expect(createCall.data.payload._verificationSource).toBe('SERVER_DATABASE_CHECK');
  });
});
