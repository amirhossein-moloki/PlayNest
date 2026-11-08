function escapeHtml(str: string | number | undefined | null): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface PaymentSuccessViewProps {
  orderId?: string | null;
  amount?: number | null;
  currency?: string | null;
  trackId?: string | number | null;
  refNumber?: string | null;
  message?: string | null;
}

export interface PaymentFailureViewProps {
  orderId?: string | null;
  trackId?: string | number | null;
  failureReason?: string | null;
  message?: string | null;
}

export function renderPaymentSuccessPage(props: PaymentSuccessViewProps): string {
  const formattedAmount = props.amount != null ? Number(props.amount).toLocaleString('fa-IR') : '-';
  const currency = props.currency || 'ریال';

  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>پرداخت موفق - پلی‌نست</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: #f3f4f6;
        color: #111827;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 16px;
        box-sizing: border-box;
      }
      .card {
        background: #ffffff;
        max-width: 480px;
        width: 100%;
        border-radius: 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        padding: 32px 24px;
        text-align: center;
      }
      .icon-container {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #ecfdf5;
        color: #059669;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        font-size: 32px;
      }
      h1 {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 8px;
        color: #065f46;
      }
      p.subtitle {
        color: #4b5563;
        font-size: 14px;
        margin: 0 0 24px;
      }
      .details-list {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px;
        text-align: right;
        margin-bottom: 24px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #f3f4f6;
        font-size: 14px;
      }
      .detail-row:last-child {
        border-bottom: none;
      }
      .detail-label {
        color: #6b7280;
      }
      .detail-value {
        font-weight: 600;
        color: #1f2937;
        direction: ltr;
      }
      .btn {
        display: inline-block;
        width: 100%;
        box-sizing: border-box;
        padding: 12px 20px;
        background: #2563eb;
        color: #ffffff;
        text-decoration: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        transition: background-color 0.2s;
      }
      .btn:hover {
        background: #1d4ed8;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-container">✓</div>
      <h1>پرداخت با موفقیت انجام شد</h1>
      <p class="subtitle">${escapeHtml(props.message || 'رزرو شما با موفقیت تأیید گردید.')}</p>

      <div class="details-list">
        ${props.refNumber ? `
        <div class="detail-row">
          <span class="detail-label">شماره پیگیری (مرجع):</span>
          <span class="detail-value">${escapeHtml(props.refNumber)}</span>
        </div>` : ''}
        ${props.trackId ? `
        <div class="detail-row">
          <span class="detail-label">شناسه تراکنش زیبال:</span>
          <span class="detail-value">${escapeHtml(props.trackId)}</span>
        </div>` : ''}
        ${props.orderId ? `
        <div class="detail-row">
          <span class="detail-label">شناسه سفارش / رزرو:</span>
          <span class="detail-value">${escapeHtml(props.orderId)}</span>
        </div>` : ''}
        ${props.amount != null ? `
        <div class="detail-row">
          <span class="detail-label">مبلغ پرداختی:</span>
          <span class="detail-value">${formattedAmount} ${escapeHtml(currency)}</span>
        </div>` : ''}
      </div>

      <a href="/customer" class="btn">بازگشت به پنل کاربری</a>
    </div>
  </body>
</html>`;
}

export function renderPaymentFailurePage(props: PaymentFailureViewProps): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>خطا در پرداخت - پلی‌نست</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: #f3f4f6;
        color: #111827;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 16px;
        box-sizing: border-box;
      }
      .card {
        background: #ffffff;
        max-width: 480px;
        width: 100%;
        border-radius: 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        padding: 32px 24px;
        text-align: center;
      }
      .icon-container {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #fef2f2;
        color: #dc2626;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        font-size: 32px;
      }
      h1 {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 8px;
        color: #991b1b;
      }
      p.subtitle {
        color: #4b5563;
        font-size: 14px;
        margin: 0 0 24px;
      }
      .details-list {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px;
        text-align: right;
        margin-bottom: 24px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #f3f4f6;
        font-size: 14px;
      }
      .detail-row:last-child {
        border-bottom: none;
      }
      .detail-label {
        color: #6b7280;
      }
      .detail-value {
        font-weight: 600;
        color: #1f2937;
        direction: ltr;
      }
      .error-box {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        border-radius: 8px;
        padding: 12px;
        font-size: 13px;
        margin-bottom: 24px;
        text-align: right;
      }
      .btn {
        display: inline-block;
        width: 100%;
        box-sizing: border-box;
        padding: 12px 20px;
        background: #2563eb;
        color: #ffffff;
        text-decoration: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        transition: background-color 0.2s;
      }
      .btn:hover {
        background: #1d4ed8;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-container">✕</div>
      <h1>پرداخت ناموفق بود</h1>
      <p class="subtitle">${escapeHtml(props.message || 'عملیات پرداخت توسط درگاه تکمیل نشد یا با خطا مواجه گردید.')}</p>

      ${props.failureReason ? `
      <div class="error-box">
        علت خطا: ${escapeHtml(props.failureReason)}
      </div>` : ''}

      <div class="details-list">
        ${props.trackId ? `
        <div class="detail-row">
          <span class="detail-label">شناسه پیگیری زیبال:</span>
          <span class="detail-value">${escapeHtml(props.trackId)}</span>
        </div>` : ''}
        ${props.orderId ? `
        <div class="detail-row">
          <span class="detail-label">شناسه سفارش / رزرو:</span>
          <span class="detail-value">${escapeHtml(props.orderId)}</span>
        </div>` : ''}
      </div>

      <a href="/customer" class="btn">بازگشت و تلاش مجدد</a>
    </div>
  </body>
</html>`;
}
