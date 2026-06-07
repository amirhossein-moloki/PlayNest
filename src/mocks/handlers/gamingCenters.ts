import { http, HttpResponse, delay } from 'msw';
import { db } from '../db';

export const gamingCenterHandlers = [
  // GET /gamingCenters
  http.get('/api/v1/gamingCenters', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: db.gamingCenters,
      meta: {
        requestId: 'req-' + Math.random().toString(36).substr(2, 9),
        pagination: { total: db.gamingCenters.length, page: 1, pageSize: 10, totalPages: 1 }
      }
    });
  }),

  // POST /gamingCenters
  http.post('/api/v1/gamingCenters', async ({ request }) => {
    await delay(Math.random() * 700 + 500);
    const body = await request.json() as Record<string, unknown>;
    const newCenter = {
      id: 'gc-' + (db.gamingCenters.length + 1),
      ...body,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    db.gamingCenters.push(newCenter as unknown as typeof db.gamingCenters[number]);
    return HttpResponse.json({
      success: true,
      data: newCenter,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),

  // GET /gamingCenters/{gamingCenterId}/stations
  http.get('/api/v1/gamingCenters/:id/stations', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const stations = db.stations.filter(s => s.gamingCenterId === id);
    return HttpResponse.json({
      success: true,
      data: stations,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /gamingCenters/{gamingCenterId}/stations
  http.post('/api/v1/gamingCenters/:id/stations', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const body = await request.json() as Record<string, unknown>;
    const newStation = {
      id: 'st-' + id + '-' + Math.random().toString(36).substr(2, 5),
      gamingCenterId: id as string,
      ...body,
      isActive: body.isActive ?? true,
    };
    db.stations.push(newStation as unknown as typeof db.stations[number]);
    return HttpResponse.json({
      success: true,
      data: newStation,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),

  // GET /gamingCenters/{gamingCenterId}/staff
  http.get('/api/v1/gamingCenters/:id/staff', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const staff = db.staff.filter(s => s.gamingCenterId === id);
    return HttpResponse.json({
      success: true,
      data: staff,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /gamingCenters/{gamingCenterId}/staff
  http.post('/api/v1/gamingCenters/:id/staff', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const body = await request.json() as Record<string, unknown>;
    const newStaff = {
      id: 'staff-' + id + '-' + Math.random().toString(36).substr(2, 5),
      gamingCenterId: id as string,
      ...body,
      isActive: true,
    };
    db.staff.push(newStaff as unknown as typeof db.staff[number]);
    return HttpResponse.json({
      success: true,
      data: newStaff,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),

  // GET /gamingCenters/{gamingCenterId}/customers
  http.get('/api/v1/gamingCenters/:id/customers', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { id } = params;
    const profiles = db.customerProfiles.filter(p => p.gamingCenterId === id);
    const customers = profiles.map(p => {
      const acc = db.customerAccounts.find(a => a.id === p.customerAccountId);
      return { ...acc, ...p };
    });
    return HttpResponse.json({
      success: true,
      data: customers,
      meta: {
        requestId: 'req-' + Math.random().toString(36).substr(2, 9),
        pagination: { total: customers.length, page: 1, pageSize: 10, totalPages: 1 }
      }
    });
  }),
];
