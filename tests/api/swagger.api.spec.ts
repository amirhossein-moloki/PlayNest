import request from 'supertest';
import app from '../../src/app';
import { describe, it, expect } from '@jest/globals';

describe('Swagger Documentation API & Security Headers', () => {
  it('should serve /api-docs/ with HTTP 200 and correct Content-Security-Policy allowing unsafe-inline', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');

    const cspHeader = res.headers['content-security-policy'] as string;
    expect(cspHeader).toBeDefined();
    expect(cspHeader).toContain('script-src \'self\' \'unsafe-inline\'');
    expect(cspHeader).toContain('style-src \'self\' \'unsafe-inline\'');
  });

  it('should serve /api-docs/swagger-ui-bundle.js with HTTP 200', async () => {
    const res = await request(app).get('/api-docs/swagger-ui-bundle.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });

  it('should serve /api-docs/swagger-ui-standalone-preset.js with HTTP 200', async () => {
    const res = await request(app).get('/api-docs/swagger-ui-standalone-preset.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });

  it('should serve /api-docs/swagger-ui-init.js with HTTP 200', async () => {
    const res = await request(app).get('/api-docs/swagger-ui-init.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });
});
