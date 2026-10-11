import { http, HttpResponse, delay } from 'msw';
import { db } from '../db';

export const authHandlers = [
  // GET /auth/me
  http.get('*/api/v1/auth/me', async () => {
    await delay(Math.random() * 700 + 500);
    const user = db.staff[0];
    return HttpResponse.json({
      success: true,
      data: user,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /auth/customer/otp/request
  http.post('*/api/v1/auth/customer/otp/request', async ({ request }) => {
    await delay(Math.random() * 700 + 500);
    const { phone } = await request.json() as { phone: string };
    if (!phone) {
      return HttpResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Phone is required' }
      }, { status: 400 });
    }
    return HttpResponse.json({
      success: true,
      data: { message: 'OTP sent' },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /auth/customer/otp/verify
  http.post('*/api/v1/auth/customer/otp/verify', async ({ request }) => {
    await delay(Math.random() * 700 + 500);
    const { phone, code } = await request.json() as { phone: string, code: string };
    if (!phone || !code) {
      return HttpResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Phone and code are required' }
      }, { status: 400 });
    }

    const customer = db.customerAccounts.find(c => c.phone === phone);
    if (!customer) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      }, { status: 404 });
    }

    return HttpResponse.json({
      success: true,
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: customer.id,
          phone: customer.phone,
          fullName: customer.fullName,
          role: 'CUSTOMER',
          isActive: true
        }
      },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // GET /customer/me
  http.get('*/api/v1/customer/me', async () => {
    await delay(Math.random() * 700 + 500);
    const customer = db.customerAccounts[0];
    return HttpResponse.json({
      success: true,
      data: customer,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),
];
