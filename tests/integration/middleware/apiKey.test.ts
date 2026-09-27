import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { env } from '../../../src/config/env';
import httpStatus from 'http-status';

describe('API Key Middleware', () => {
  const validApiKey = env.STATIC_API_KEY;

  it('should return 401 if x-api-key header is missing', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
    expect(response.body.error.message).toBe('Invalid or missing API key');
  });

  it('should return 401 if x-api-key header is invalid', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('x-api-key', 'invalid-key');
    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
    expect(response.body.error.message).toBe('Invalid or missing API key');
  });

  it('should allow the request if x-api-key header is valid', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('x-api-key', validApiKey);

    expect(response.status).not.toBe(httpStatus.UNAUTHORIZED);
  });

  it('should allow access to /api-docs without x-api-key header', async () => {
    const response = await request(app).get('/api-docs/');
    // Swagger UI returns 200 or 301/200 when accessing /api-docs/
    expect([httpStatus.OK, httpStatus.MOVED_PERMANENTLY]).toContain(response.status);
  });
});
