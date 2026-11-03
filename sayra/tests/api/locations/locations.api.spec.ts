import request from 'supertest';
import app from '../../../src/app';

describe('Locations API', () => {
  it('GET /api/v1/locations/provinces returns a list of Iran provinces', async () => {
    const res = await request(app).get('/api/v1/locations/provinces');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((p: { slug: string }) => p.slug === 'tehran')).toBe(true);
  });

  it('GET /api/v1/locations/provinces/:id/cities returns cities for a valid province', async () => {
    const res = await request(app).get('/api/v1/locations/provinces/province_tehran/cities');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((c: { slug: string }) => c.slug === 'tehran')).toBe(true);
  });

  it('GET /api/v1/locations/provinces/:id/cities returns 404 for unknown province', async () => {
    const res = await request(app).get('/api/v1/locations/provinces/non_existent_province/cities');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
