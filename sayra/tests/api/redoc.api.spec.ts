import request from 'supertest';
import app from '../../src/app';
import { describe, it, expect } from '@jest/globals';

describe('ReDoc Documentation API & Security Headers', () => {
  it('should serve /redoc with HTTP 200, local ReDoc asset script, and correct Content-Security-Policy', async () => {
    const res = await request(app).get('/redoc');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('PlayNest API Documentation - ReDoc');
    expect(res.text).toContain('<redoc spec-url="/openapi.json"></redoc>');
    expect(res.text).toContain('/redoc-assets/redoc.standalone.js');
    expect(res.text).toContain('/openapi.json');

    const cspHeader = res.headers['content-security-policy'] as string;
    expect(cspHeader).toBeDefined();
    expect(cspHeader).toContain('script-src \'self\'');
    expect(cspHeader).toContain('worker-src \'self\' blob:');
  });

  it('should serve /redoc/ with HTTP 200 and local ReDoc asset script', async () => {
    const res = await request(app).get('/redoc/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('PlayNest API Documentation - ReDoc');
    expect(res.text).toContain('/redoc-assets/redoc.standalone.js');
    expect(res.text).toContain('/openapi.json');
  });

  it('should serve /redoc-assets/redoc.standalone.js with HTTP 200 and correct JavaScript MIME type', async () => {
    const res = await request(app).get('/redoc-assets/redoc.standalone.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/(?:application|text)\/javascript/);
    expect(res.text.length).toBeGreaterThan(100000);
    expect(res.text).toContain('2.1.5');
  });

  it('should serve /openapi.json with HTTP 200 and valid JSON', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toBeDefined();
    expect(res.body.openapi || res.body.swagger).toBeDefined();
  });
});
