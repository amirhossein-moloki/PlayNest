# مستند قرارداد API شارژ آنلاین کیف پول کاربران (Customer Wallet Online Charging)

این مستند قرارداد رسمی بین بک‌اند (Sayra API) و فرانت‌اند (`walletService.chargeWallet`) را برای قابلیت شارژ آنلاین کیف پول از طریق درگاه امن زیبال (Zibal) مشخص می‌کند.

---

## ۱. مرور کلی و اصول معماری

- **استقلال از فرآیند رزرو:** عملیات شارژ کیف پول کاملاً مستقل از رزرو، سانس‌ها و `BookingHold` انجام می‌پذیرد.
- **واحد پولی (Currency):**
  - فرانت‌اند می‌تواند مبلغ را برحسب تومان (`IRT`) یا ریال (`IRR`) ارسال کند (پیش‌فرض: `IRT`).
  - بک‌اند مبلغ را با دقت به ریال تبدیل کرده و در پایگاه داده و درگاه زیبال با واحد استاندارد ریال ثبت می‌نماید.
  - حداقل مبلغ شارژ: **۱,۰۰۰ تومان** (۱۰,۰۰۰ ریال).
  - حداکثر مبلغ شارژ در هر تراکنش: **۵۰,۰۰۰,۰۰۰ تومان** (۵۰۰,۰۰۰,۰۰۰ ریال).
- **اتومیسیتی و امنیت:** افزایش موجودی کیف پول صرفاً پس از استعلام و Verify رسمی و سرور‌به‌سرور از زیبال انجام می‌شود و با تراکنش دیتابیس و قفل ردیف ایزوله شده است.
- **Idempotency (تکرارناپذیری):** پشتیبانی از هدر `Idempotency-Key` برای جلوگیری از تراکنش‌های تکراری در هنگام قطعی یا ارسال مجدد درخواست توسط فرانت‌اند.

---

## ۲. اندپوینت‌های API

### ۲.۱. شروع فرآیند شارژ کیف پول (Initiate Wallet Charge)

کاربر مبلغ موردنظر برای شارژ را ارسال کرده و لینک مستقیم ورود به درگاه پرداخت زیبال را دریافت می‌کند.

- **مسیر (Endpoint):** `POST /api/v1/customer/wallet/charge`
- **احراز هویت:** اجباری (Bearer Token با نقش `CUSTOMER`)
- **هدرهای اختیاری / پیشنهادی:**
  - `Idempotency-Key`: رشته یکتا (UUID v4 یا شناسه امن با طول حداقل ۱۶ کاراکتر)

#### بدنه درخواست (Request Body)
```json
{
  "amount": 500000,
  "currency": "IRT"
}
```

#### پارامترهای درخواست
| نام فیلد | نوع | الزامی؟ | توضیحات |
| :--- | :--- | :--- | :--- |
| `amount` | `integer` | بله | مبلغ شارژ به عنوان عدد صحیح مثبت بزرگتر از صفر. |
| `currency` | `string` | خیر | واحد پول ارسالی: `IRT` (تومان) یا `IRR` (ریال). پیش‌فرض: `IRT`. |

#### پاسخ موفق (`201 Created`)
```json
{
  "success": true,
  "data": {
    "chargeId": "cm1234567890abcdef",
    "trackId": "12345678",
    "paymentUrl": "https://gateway.zibal.ir/start/12345678",
    "amount": 5000000,
    "currency": "IRR",
    "status": "PENDING"
  }
}
```

#### پاسخ‌های خطا
- **`400 Bad Request`**: مبلغ نامعتبر، صفر، منفی یا کمتر از حداقل مجاز.
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Minimum wallet charge amount is ۱,۰۰۰ Tomans (۱۰,۰۰۰ Rials)"
  }
}
```
- **`401 Unauthorized`**: کاربر لاگین نکرده یا توکن منقضی است.
- **`502 Bad Gateway`**: بروز اختلال در اتصال اولیه به وب‌سرویس زیبال.

---

### ۲.۲. استعلام وضعیت تراکنش شارژ (Get Charge Status)

برای بررسی وضعیت نهایی شارژ کیف پول توسط فرانت‌اند (مثلاً در صفحه بازگشت از درگاه یا تاریخچه).

- **مسیر (Endpoint):** `GET /api/v1/customer/wallet/charge/:chargeId`
- **احراز هویت:** اجباری (Bearer Token با نقش `CUSTOMER`)

#### پاسخ موفق (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "cm1234567890abcdef",
    "customerAccountId": "cuid_customer_123",
    "amount": 5000000,
    "currency": "IRR",
    "provider": "ZIBAL",
    "status": "PAID",
    "trackId": "12345678",
    "refNumber": "789123456",
    "failureReason": null,
    "paidAt": "2026-03-30T12:00:00.000Z",
    "createdAt": "2026-03-30T11:58:00.000Z",
    "updatedAt": "2026-03-30T12:00:00.000Z"
  }
}
```

#### وضعیت‌های ممکن (`status`):
- `PENDING`: تراکنش ایجاد شده و در انتظار پرداخت کاربر است.
- `PROCESSING`: در حال انجام اعتبارسنجی با درگاه.
- `PAID`: پرداخت با موفقیت تأیید شده و موجودی کیف پول افزایش یافته است.
- `FAILED`: پرداخت توسط درگاه یا به دلیل عدم تطابق مبلغ رد شد.
- `CANCELLED`: پرداخت توسط کاربر در صفحه بانک لغو شد.

---

## ۳. فرآیند بازگشت از درگاه (Callback & Redirect)

1. زیبال پس از اتمام پرداخت کاربر را به مسیر Callback بک‌اند هدایت می‌کند:
   - مسیر اختصاصی: `/api/v1/payments/zibal/wallet/callback`
   - مسیر مشترک با رزرو: `/api/v1/payments/zibal/callback` (به صورت هوشمند نوع تراکنش را تشخیص می‌دهد).
2. بک‌اند پرداخت را از طریق متد `verifyPayment` با API زیبال کنترل می‌کند.
3. در صورت موفقیت:
   - تراکنش به `PAID` تغییر وضعیت داده و فیلدهای `paidAt` و `refNumber` پر می‌شوند.
   - موجودی کیف پول کاربر (`walletBalance`) به میزان مبلغ تراکنش افزایش می‌یابد.
   - یک رکورد تراکنش در `WalletTransaction` با نوع `DEPOSIT` ثبت می‌شود.
   - یک اعلان درون‌برنامه‌ای در `CustomerNotification` برای کاربر درج می‌گردد.
   - کاربر به آدرس `PAYMENT_SUCCESS_URL` ریدایرکت ۳۰۲ می‌شود:
     ```text
     https://sayra-booking.ir/payment/success?orderId=cm123456...&amount=5000000&currency=IRR&trackId=12345678&refNumber=789123456&type=wallet_charge&status=success
     ```
4. در صورت عدم موفقیت:
   - وضعیت تراکنش `FAILED` یا `CANCELLED` می‌شود.
   - هیچ تغییری در موجودی کاربر ایجاد نمی‌شود.
   - کاربر به آدرس `PAYMENT_FAILED_URL` ریدایرکت ۳۰۲ می‌شود:
     ```text
     https://sayra-booking.ir/payment/failed?orderId=cm123456...&trackId=12345678&failureReason=...&type=wallet_charge&status=failed
     ```

---

## ۴. نحوه استفاده در فرانت‌اند (`walletService.chargeWallet`)

```typescript
// Example frontend service integration
export const walletService = {
  async chargeWallet(amount: number, currency: 'IRT' | 'IRR' = 'IRT', idempotencyKey?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch('/api/v1/customer/wallet/charge', {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount, currency }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Wallet charge failed');
    }

    // Redirect user to gateway
    if (data.data?.paymentUrl) {
      window.location.href = data.data.paymentUrl;
    }
    return data.data;
  },

  async getChargeStatus(chargeId: string) {
    const response = await fetch(`/api/v1/customer/wallet/charge/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });
    return response.json();
  }
};
```
