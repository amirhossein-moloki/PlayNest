import { http, HttpResponse, delay } from 'msw';
import { db } from '../db';

export const publicHandlers = [
  // GET /public/gamingCenters/{gamingCenterSlug}
  http.get('*/api/v1/public/gamingCenters/:slug', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { slug } = params;
    const center = db.gamingCenters.find(c => c.slug === slug);
    if (!center) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Gaming center not found' }
      }, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: center,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /public/gamingCenters/{gamingCenterSlug}/pages/{pageSlug}
  http.get('*/api/v1/public/gamingCenters/:slug/pages/:pageSlug', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { slug, pageSlug } = params;
    const center = db.gamingCenters.find(c => c.slug === slug);
    if (!center) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Center not found' } }, { status: 404 });

    const page = {
      id: 'page-1',
      gamingCenterId: center.id,
      slug: pageSlug,
      title: 'Mock Page',
      type: 'HOME',
      status: 'PUBLISHED',
      sections: [
        {
          id: 'sec-1',
          type: 'HERO',
          dataJson: JSON.stringify({ title: 'Welcome', subtitle: 'Mocked Content' }),
          sortOrder: 0,
        }
      ]
    };

    return HttpResponse.json({
      success: true,
      data: page,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /public/gamingCenters/{gamingCenterSlug}/media
  http.get('*/api/v1/public/gamingCenters/:slug/media', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: [],
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /public/gamingCenters/{gamingCenterSlug}/links
  http.get('*/api/v1/public/gamingCenters/:slug/links', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: [
        { type: 'INSTAGRAM', label: 'Instagram', value: '@mock' }
      ],
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /public/gamingCenters/{gamingCenterSlug}/addresses
  http.get('*/api/v1/public/gamingCenters/:slug/addresses', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: [
        { city: 'Tabriz', province: 'East Azerbaijan', district: 'Center', addressLine: 'Main St', isPrimary: true }
      ],
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /public/gamingCenters/{gamingCenterSlug}/ratings
  http.get('*/api/v1/public/gamingCenters/:slug/ratings', async () => {
    await delay(Math.random() * 700 + 500);
    return HttpResponse.json({
      success: true,
      data: [],
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /public/gamingCenters/{gamingCenterSlug}/reservation
  http.post('*/api/v1/public/gamingCenters/:slug/reservation', async ({ request }) => {
    await delay(Math.random() * 700 + 500);
    const body = await request.json() as Record<string, unknown>;
    const newRes = {
      id: 'res-' + Math.random().toString(36).substr(2, 9),
      ...body,
      status: 'PENDING',
      paymentState: 'UNPAID',
      createdAt: new Date().toISOString()
    };
    db.reservations.push(newRes as unknown as typeof db.reservations[number]);
    return HttpResponse.json({
      success: true,
      data: newRes,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),
];
