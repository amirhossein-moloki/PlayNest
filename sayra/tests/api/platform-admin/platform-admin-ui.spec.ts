import request from 'supertest';
import app from '../../../src/app';

describe('Platform Admin UI Frontend Dashboard', () => {
  it('should serve HTML dashboard template on GET /api/v1/platform-admin/dashboard without auth block', async () => {
    const res = await request(app).get('/api/v1/platform-admin/dashboard');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('PlayNest Central Console');
    expect(res.text).toContain('module-dashboard');
    expect(res.text).toContain('module-users');
    expect(res.text).toContain('module-centers');
    expect(res.text).toContain('module-reservations');
    expect(res.text).toContain('module-verifications');
    expect(res.text).toContain('module-ads');
    expect(res.text).toContain('module-campaigns');
    expect(res.text).toContain('module-settings');
    expect(res.text).toContain('module-blog');
    expect(res.text).toContain('module-analytics');
    expect(res.text).toContain('module-audit');
    expect(res.text).toContain('/api/v1/auth/platform-admin/login');
  });

  it('should include API client error handling and token authentication dialog', async () => {
    const res = await request(app).get('/api/v1/platform-admin/dashboard');

    expect(res.status).toBe(200);
    expect(res.text).toContain('modal-auth');
    expect(res.text).toContain('apiRequest');
    expect(res.text).not.toContain('prompt(\'Please enter your PLATFORM_ADMIN');
  });
});
