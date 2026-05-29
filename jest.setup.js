jest.mock('pino', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('./src/modules/notifications/sms.station');

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    on: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

jest.mock('./src/jobs/producers/sms.producer', () => ({
  queueSms: jest.fn(),
}));

jest.mock('./src/jobs/producers/analytics.producer', () => ({
  queueAnalyticsSync: jest.fn(),
}));
