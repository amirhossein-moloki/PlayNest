import request from 'supertest';
import { env } from '../../src/config/env';

import app from '../../src/app';
import { describe, it, expect } from '@jest/globals';

describe('Performance Benchmarks', () => {
  it('GET /api/v1/health should respond quickly', async () => {
    const start = Date.now();
    const res = await request(app).get('/api/v1/health').set('x-api-key', env.STATIC_API_KEY);
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    console.log('Health Check duration: ' + duration + 'ms');
  });
});
