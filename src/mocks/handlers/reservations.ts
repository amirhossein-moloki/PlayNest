import { http, HttpResponse, delay } from 'msw';
import { db } from '../db';

export const reservationHandlers = [
  // GET /gamingCenters/{gamingCenterId}/reservation
  http.get('/api/v1/gamingCenters/:gcId/reservation', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { gcId } = params;
    const res = db.reservations.filter(r => r.gamingCenterId === gcId);
    return HttpResponse.json({
      success: true,
      data: res,
      meta: {
        requestId: 'req-' + Math.random().toString(36).substr(2, 9),
        pagination: { total: res.length, page: 1, pageSize: 10, totalPages: 1 }
      }
    });
  }),

  // POST /gamingCenters/{gamingCenterId}/reservation
  http.post('/api/v1/gamingCenters/:gcId/reservation', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { gcId } = params;
    const body = await request.json() as Record<string, unknown>;
    const station = db.stations.find(s => s.id === body.stationId);
    const newRes = {
      id: 'res-' + Math.random().toString(36).substr(2, 9),
      gamingCenterId: gcId as string,
      ...body,
      status: 'CONFIRMED',
      paymentState: 'PENDING',
      stationSnapshot: station ? { name: station.name, hourlyPrice: station.hourlyPrice, stationType: station.stationType } : {},
      createdAt: new Date().toISOString()
    };
    db.reservations.push(newRes as unknown as typeof db.reservations[number]);
    return HttpResponse.json({
      success: true,
      data: newRes,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),

  // GET /gamingCenters/{gamingCenterId}/reservation/{reservationId}
  http.get('/api/v1/gamingCenters/:gcId/reservation/:resId', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { resId } = params;
    const res = db.reservations.find(r => r.id === resId);
    if (!res) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 });
    return HttpResponse.json({
      success: true,
      data: res,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /gamingCenters/{gamingCenterId}/reservation/{reservationId}/sessions/start
  http.post('/api/v1/gamingCenters/:gcId/reservation/:resId/sessions/start', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { resId } = params;
    const res = db.reservations.find(r => r.id === resId);
    if (res) res.status = 'IN_PROGRESS';
    return HttpResponse.json({
      success: true,
      data: { status: 'IN_PROGRESS' },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),

  // POST /gamingCenters/{gamingCenterId}/reservation/{reservationId}/sessions/stop
  http.post('/api/v1/gamingCenters/:gcId/reservation/:resId/sessions/stop', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { resId } = params;
    const res = db.reservations.find(r => r.id === resId);
    if (res) res.status = 'COMPLETED';
    return HttpResponse.json({
      success: true,
      data: { status: 'COMPLETED' },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /gamingCenters/{gamingCenterId}/reservation/{reservationId}/payments/init
  http.post('/api/v1/gamingCenters/:gcId/reservation/:resId/payments/init', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { resId } = params;
    const res = db.reservations.find(r => r.id === resId);
    if (res) res.paymentState = 'PAID';
    return HttpResponse.json({
      success: true,
      data: { status: 'PAID' },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /customer/reservation
  http.get('/api/v1/customer/reservation', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: db.reservations,
      meta: {
        requestId: 'req-' + Math.random().toString(36).substr(2, 9),
        pagination: { total: db.reservations.length, page: 1, pageSize: 10, totalPages: 1 }
      }
    });
  }),

  // POST /customer/reservation/{reservationId}/cancel
  http.post('/api/v1/customer/reservation/:resId/cancel', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { resId } = params;
    const res = db.reservations.find(r => r.id === resId);
    if (res) res.status = 'CANCELED';
    return HttpResponse.json({
      success: true,
      data: { status: 'CANCELED' },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),
];
