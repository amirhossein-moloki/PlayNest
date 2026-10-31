import request from 'supertest';
import app from '../../src/app';
import { describe, it, expect } from '@jest/globals';

describe('ReDoc Documentation API & Security Headers', () => {
  it('should serve /redoc with HTTP 200 and correct Content-Security-Policy allowing ReDoc CDN assets', async () => {
    const res = await request(app).get('/redoc');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('PlayNest API Documentation - ReDoc');
    expect(res.text).toContain('<redoc spec-url="/openapi.json"></redoc>');
    expect(res.text).toContain('cdn.redoc.ly/redoc/v2.1.5/bundles/redoc.standalone.js');
    expect(res.text).toContain('/openapi.json');

    const cspHeader = res.headers['content-security-policy'] as string;
    expect(cspHeader).toBeDefined();
    expect(cspHeader).toContain('https://cdn.redoc.ly');
    expect(cspHeader).toContain('worker-src \'self\' blob:');
  });

  it('should serve /redoc/ with HTTP 200', async () => {
    const res = await request(app).get('/redoc/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('PlayNest API Documentation - ReDoc');
    expect(res.text).toContain('/openapi.json');
  });
});
