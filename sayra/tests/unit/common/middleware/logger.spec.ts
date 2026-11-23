import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import express, { Request, Response, RequestHandler } from 'express';
import request from 'supertest';

describe('Logger Middleware', () => {
  let originalEnableTestLogger: string | undefined;

  beforeAll(() => {
    originalEnableTestLogger = process.env.ENABLE_TEST_LOGGER;
    process.env.ENABLE_TEST_LOGGER = 'true';
    jest.unmock('../../../../src/config/logger');
    jest.resetModules();
  });

  afterAll(() => {
    process.env.ENABLE_TEST_LOGGER = originalEnableTestLogger;
    jest.resetModules();
  });

  it('should process request and attach correlation/request headers without throwing', async () => {
    const loggerModule = await import('../../../../src/common/middleware/logger');
    const loggerMiddleware: RequestHandler = loggerModule.default;

    const app = express();
    app.use(loggerMiddleware);
    app.get('/test', (req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('should reuse existing x-request-id and x-correlation-id if provided', async () => {
    const loggerModule = await import('../../../../src/common/middleware/logger');
    const loggerMiddleware: RequestHandler = loggerModule.default;

    const app = express();
    app.use(loggerMiddleware);
    app.get('/test', (req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    const customReqId = 'custom-req-123';
    const customCorrId = 'custom-corr-456';

    const res = await request(app)
      .get('/test')
      .set('x-request-id', customReqId)
      .set('x-correlation-id', customCorrId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customReqId);
    expect(res.headers['x-correlation-id']).toBe(customCorrId);
  });

  it('should safely handle 404 and 500 status codes', async () => {
    const loggerModule = await import('../../../../src/common/middleware/logger');
    const loggerMiddleware: RequestHandler = loggerModule.default;

    const app = express();
    app.use(loggerMiddleware);
    app.get('/error', (req: Request, res: Response) => {
      res.status(500).json({ error: 'internal server error' });
    });

    const res1 = await request(app).get('/non-existent');
    expect(res1.status).toBe(404);

    const res2 = await request(app).get('/error');
    expect(res2.status).toBe(500);
  });

  it('should contain zero JSON.parse(JSON.stringify calls and ignore /health in pino-http autoLogging', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../../src/common/middleware/logger.ts'),
      'utf8'
    );
    expect(source).not.toContain('JSON.parse(JSON.stringify');
    expect(source).not.toContain('Metrics.recordApiLatency');

    const { Metrics } = await import('../../../../src/common/metrics/metrics');
    const metricSpy = jest.spyOn(Metrics, 'recordApiLatency');

    const loggerModule = await import('../../../../src/common/middleware/logger');
    const loggerMiddleware: RequestHandler = loggerModule.default;

    const app = express();
    app.use(loggerMiddleware);
    app.get('/health', (_req: Request, res: Response) => res.status(200).json({ status: 'ok' }));
    app.get('/api/v1/sample', (_req: Request, res: Response) => res.status(200).json({ ok: true }));

    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    const sampleRes = await request(app).get('/api/v1/sample');
    expect(sampleRes.status).toBe(200);

    expect(metricSpy).not.toHaveBeenCalled();
    metricSpy.mockRestore();
  });
});
