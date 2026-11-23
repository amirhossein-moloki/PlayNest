/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import app from '../../src/app';

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    platformSetting: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ maintenanceMode: false })),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
    },
    $extends: jest.fn().mockReturnThis(),
  },
  connectPrisma: jest.fn(),
  disconnectPrisma: jest.fn(),
}));

describe('Standard 404 & JSON API Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const assertStandardJsonError = (
    res: request.Response,
    expectedStatus: number,
    expectedCode: string
  ) => {
    expect(res.status).toBe(expectedStatus);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.text).not.toMatch(/<!DOCTYPE|<html/i);
    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(expectedCode);
    expect(typeof res.body.error.message).toBe('string');
    expect(res.body.error.message.length).toBeGreaterThan(0);
  };

  describe('1. Unmatched routes return standard 404 JSON', () => {
    it('returns standard 404 JSON for unknown /api/v1 paths', async () => {
      const getRes = await request(app).get('/api/v1/non-existent');
      assertStandardJsonError(getRes, 404, 'ROUTE_NOT_FOUND');
      expect(getRes.body.error.message).toBe('Route GET /api/v1/non-existent not found.');
      expect(getRes.body.error.details).toEqual({
        method: 'GET',
        path: '/api/v1/non-existent',
      });

      const postRes = await request(app).post('/api/v1/non-existent').send({ foo: 'bar' });
      assertStandardJsonError(postRes, 404, 'ROUTE_NOT_FOUND');
      expect(postRes.body.error.message).toBe('Route POST /api/v1/non-existent not found.');
      expect(postRes.body.error.details).toEqual({
        method: 'POST',
        path: '/api/v1/non-existent',
      });
    });

    it('strips query parameters from 404 message and details.path', async () => {
      const res = await request(app).get('/api/v1/non-existent?token=secret-value&foo=bar');
      assertStandardJsonError(res, 404, 'ROUTE_NOT_FOUND');
      expect(res.body.error.message).toBe('Route GET /api/v1/non-existent not found.');
      expect(res.body.error.message).not.toContain('secret-value');
      expect(res.body.error.details).toEqual({
        method: 'GET',
        path: '/api/v1/non-existent',
      });
    });

    it('returns standard 404 JSON for unknown root-level routes even with Accept: text/html', async () => {
      const res = await request(app)
        .get('/does-not-exist')
        .set('Accept', 'text/html,application/xhtml+xml');
      assertStandardJsonError(res, 404, 'ROUTE_NOT_FOUND');
      expect(res.body.error.details).toEqual({
        method: 'GET',
        path: '/does-not-exist',
      });
    });

    it('returns standard 404 JSON for missing static upload files instead of Express HTML', async () => {
      const res = await request(app)
        .get('/uploads/missing-file-12345.png')
        .set('Accept', 'text/html');
      assertStandardJsonError(res, 404, 'ROUTE_NOT_FOUND');
      expect(res.body.error.details).toEqual({
        method: 'GET',
        path: '/uploads/missing-file-12345.png',
      });
    });
  });

  describe('2. Unsupported HTTP methods on existing routes return standard 404 JSON', () => {
    it.each([
      ['POST', '/api/v1/health'],
      ['DELETE', '/api/v1/health'],
      ['GET', '/api/v1/auth/login'],
      ['PUT', '/api/v1/auth/login'],
      ['DELETE', '/api/v1/catalog/games'],
      ['PUT', '/api/v1/gamingCenters/gc-1'],
      ['GET', '/api/v1/gamingCenters/gc-1/nonexistent'],
      ['DELETE', '/api/v1/public/gamingCenters/demo-center/ratings'],
      ['GET', '/api/v1/admin/nonexistent'],
      ['POST', '/health'],
      ['POST', '/openapi.json'],
    ])('%s %s returns 404 ROUTE_NOT_FOUND JSON instead of HTML or 501', async (method, urlPath) => {
      const req = (request(app) as any)[method.toLowerCase()](urlPath)
        .set('Accept', 'application/json');
      const res = await req;

      assertStandardJsonError(res, 404, 'ROUTE_NOT_FOUND');
      expect(res.body.error.message).not.toContain('CMS routes placeholder');
      expect(res.body.error.details).toEqual({
        method,
        path: urlPath,
      });
    });
  });

  describe('3. Built-in Express parser and URI errors return standard JSON', () => {
    it('returns 400 INVALID_JSON when request body contains malformed JSON', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .set('Accept', 'text/html')
        .send('{"broken":');

      assertStandardJsonError(res, 400, 'INVALID_JSON');
      expect(res.body.error.message).toBe('Malformed JSON payload.');
    });

    it('returns 400 BAD_REQUEST JSON when URI path param contains malformed percent encoding', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/%E0%A4%A')
        .set('Accept', 'text/html');

      assertStandardJsonError(res, 400, 'BAD_REQUEST');
    });
  });

  describe('4. Platform Admin mount slot ordering', () => {
    it('serves mounted platformAdminRouter before notFoundHandler and returns 404 when unmounted', async () => {
      const unmountedRes = await request(app).get('/platform-admin-panel');
      assertStandardJsonError(unmountedRes, 404, 'ROUTE_NOT_FOUND');

      const mockAdminRouter = express.Router();
      mockAdminRouter.get('/', (_req, res) => {
        res.status(200).json({ ok: true, panel: 'mounted' });
      });

      const previousRouter = app.locals.platformAdminRouter;
      app.locals.platformAdminRouter = mockAdminRouter;
      try {
        const mountedRes = await request(app).get('/platform-admin-panel');
        expect(mountedRes.status).toBe(200);
        expect(mountedRes.body).toEqual({ ok: true, panel: 'mounted' });
      } finally {
        app.locals.platformAdminRouter = previousRouter;
      }

      const restoredRes = await request(app).get('/platform-admin-panel');
      assertStandardJsonError(restoredRes, 404, 'ROUTE_NOT_FOUND');
    });
  });

  describe('5. Existing valid endpoints remain unaffected', () => {
    it('serves /health, /api/v1/health, and /openapi.json with 200', async () => {
      const rootHealth = await request(app).get('/health');
      expect(rootHealth.status).toBe(200);
      expect(rootHealth.body.success).toBe(true);
      expect(rootHealth.body.data).toEqual({ status: 'ok' });

      const apiHealth = await request(app).get('/api/v1/health');
      expect(apiHealth.status).toBe(200);
      expect(apiHealth.body.success).toBe(true);
      expect(apiHealth.body.data).toEqual({ status: 'ok' });

      const openapiJson = await request(app).get('/openapi.json');
      expect(openapiJson.status).toBe(200);
      expect(openapiJson.headers['content-type']).toMatch(/application\/json/);
      expect(openapiJson.body.openapi).toBeDefined();
    });
  });
});
