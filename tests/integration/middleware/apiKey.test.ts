import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { env } from '../../../src/config/env';
import httpStatus from 'http-status';

describe('API Key Middleware', () => {
  const validApiKey = env.STATIC_API_KEY;

  it('should return 401 if x-api-key header is missing on protected routes', async () => {
    const response = await request(app).get('/api/v1/gamingCenters');
    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
    expect(response.body.error.message).toBe('Invalid or missing API key');
  });

  it('should return 401 if x-api-key header is invalid on protected routes', async () => {
    const response = await request(app)
      .get('/api/v1/gamingCenters')
      .set('x-api-key', 'invalid-key');
    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
    expect(response.body.error.message).toBe('Invalid or missing API key');
  });

  it('should allow the request if x-api-key header is valid', async () => {
    const response = await request(app)
      .get('/api/v1/gamingCenters')
      .set('x-api-key', validApiKey);

    expect(response.status).not.toBe(httpStatus.UNAUTHORIZED);
  });

  it('should allow access to /api-docs without x-api-key header', async () => {
    const response = await request(app).get('/api-docs/');
    expect([httpStatus.OK, httpStatus.MOVED_PERMANENTLY]).toContain(response.status);
  });

  it('should allow access to /swagger and /docs without x-api-key header', async () => {
    const swaggerRes = await request(app).get('/swagger/');
    expect([httpStatus.OK, httpStatus.MOVED_PERMANENTLY]).toContain(swaggerRes.status);

    const docsRes = await request(app).get('/docs/');
    expect([httpStatus.OK, httpStatus.MOVED_PERMANENTLY]).toContain(docsRes.status);
  });

  it('should allow access to /openapi.yaml and /openapi.json without x-api-key header', async () => {
    const yamlRes = await request(app).get('/openapi.yaml');
    expect(yamlRes.status).toBe(httpStatus.OK);

    const jsonRes = await request(app).get('/openapi.json');
    expect(jsonRes.status).toBe(httpStatus.OK);
  });

  it('should allow access to health check endpoints (/health and /api/v1/health) without x-api-key header', async () => {
    const rootHealthRes = await request(app).get('/health');
    expect(rootHealthRes.status).toBe(httpStatus.OK);
    expect(rootHealthRes.body).toEqual({
      success: true,
      data: { status: 'ok' },
    });

    const apiHealthRes = await request(app).get('/api/v1/health');
    expect(apiHealthRes.status).toBe(httpStatus.OK);
    expect(apiHealthRes.body).toEqual({
      success: true,
      data: { status: 'ok' },
    });
  });

  it('should allow access to webhook endpoints without x-api-key header', async () => {
    const webhookRes = await request(app)
      .post('/api/v1/webhooks/payments/zarinpal')
      .send({});
    // Should bypass apiKeyMiddleware (not failing with 'Invalid or missing API key')
    expect(webhookRes.body?.error?.message).not.toBe('Invalid or missing API key');
  });
});
