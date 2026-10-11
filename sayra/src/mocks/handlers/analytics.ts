import { http, HttpResponse, delay } from 'msw';
import { db } from '../db';

export const analyticsHandlers = [
  // GET /gamingCenters/{gamingCenterId}/analytics/summary
  http.get('/api/v1/gamingCenters/:id/analytics/summary', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: {
        totalRevenue: 15000000,
        activeReservations: 5,
        occupancyRate: 45,
        newCustomers: 12
      },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /gamingCenters/{gamingCenterId}/analytics/staff
  http.get('/api/v1/gamingCenters/:id/analytics/staff', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: [
        { staffId: 'staff-1', fullName: 'John Doe', reservationsCount: 45, totalRevenue: 2500000 }
      ],
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /gamingCenters/{gamingCenterId}/analytics/stations
  http.get('/api/v1/gamingCenters/:id/analytics/stations', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: [
        { stationId: 'st-1', name: 'PC-1', usageHours: 120, occupancyRate: 75 }
      ],
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /gamingCenters/{gamingCenterId}/analytics/revenue-chart
  http.get('/api/v1/gamingCenters/:id/analytics/revenue-chart', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: [
        { date: '2023-01-01', amount: 500000 },
        { date: '2023-01-02', amount: 750000 }
      ],
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),
];

export const cmsHandlers = [
  // GET /gamingCenters/{gamingCenterId}/site-settings
  http.get('/api/v1/gamingCenters/:id/site-settings', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const settings = db.siteSettings.find(s => s.gamingCenterId === id);
    return HttpResponse.json({
      success: true,
      data: settings,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // PATCH /gamingCenters/{gamingCenterId}/site-settings
  http.patch('/api/v1/gamingCenters/:id/site-settings', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const body = await request.json() as Record<string, unknown>;
    const settings = db.siteSettings.find(s => s.gamingCenterId === id);
    if (settings) Object.assign(settings, body);
    return HttpResponse.json({
      success: true,
      data: settings,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /gamingCenters/{gamingCenterId}/settings
  http.get('/api/v1/gamingCenters/:id/settings', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const settings = db.settings.find(s => s.gamingCenterId === id);
    return HttpResponse.json({
      success: true,
      data: settings,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // PUT /gamingCenters/{gamingCenterId}/settings
  http.put('/api/v1/gamingCenters/:id/settings', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const body = await request.json() as Record<string, unknown>;
    const settings = db.settings.find(s => s.gamingCenterId === id);
    if (settings) Object.assign(settings, body);
    return HttpResponse.json({
      success: true,
      data: settings,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),
];

export const commissionHandlers = [
  // GET /gamingCenters/{gamingCenterId}/commissions
  http.get('/api/v1/gamingCenters/:id/commissions', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: db.earnings,
      meta: {
        requestId: 'req-' + Math.random().toString(36).substr(2, 9),
        pagination: { total: db.earnings.length, page: 1, pageSize: 10, totalPages: 1 }
      }
    });
  }),

  // GET /gamingCenters/{gamingCenterId}/commissions/policy
  http.get('/api/v1/gamingCenters/:id/commissions/policy', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const policy = db.commissionPolicies.find(p => p.gamingCenterId === id);
    return HttpResponse.json({
      success: true,
      data: policy,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /gamingCenters/{gamingCenterId}/commissions/policy
  http.post('/api/v1/gamingCenters/:id/commissions/policy', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const body = await request.json() as Record<string, unknown>;
    const policy = db.commissionPolicies.find(p => p.gamingCenterId === id);
    if (policy) Object.assign(policy, body);
    return HttpResponse.json({
      success: true,
      data: policy,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),
];
