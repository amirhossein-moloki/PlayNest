# ۵. مشخصات پیشنهادی ردیابی رویداد
این مشخصات طرح هدف است، نه ادعای وجود event bus یا tracking فعلی. جست‌وجوی frontend برای `page_view`, `gtag`, `Google Analytics` و `booking_started` نتیجه‌ای نداشت. رویدادهای تراکنشی موجود در پایگاه داده منبع معتبرتری برای وضعیت نهایی رزرو/پرداخت‌اند؛ رویداد وب باید فقط شکاف قیف را پر کند.

## قرارداد مشترک رویداد
هر رکورد پیشنهادی شامل:
- `event_id`: UUID یکتا یا شناسه idempotency.
- `event_name`: نام نسخه‌دار/پایدار.
- `occurred_at`: زمان UTC رخداد؛ `received_at`: زمان ورود به collector.
- `anonymous_id`, `session_id`: nullable و تصادفی، فقط با مبنای رضایت/قانونی.
- `customer_account_id`: nullable؛ شناسه داخلی pseudonymous در dataset تحلیلی.
- `gaming_center_id`, `reservation_id`, `gaming_session_id`, `station_id`, `payment_id`: nullable بر حسب دامنه.
- `source`, `schema_version`, `environment`, `consent_state`, `properties`.
- از email، phone، token، OTP، متن آزاد، IP خام و query string حاوی اطلاعات شخصی در properties اجتناب شود.

## رویدادهای پیشنهادی

| نام رویداد | Trigger | خصوصیات افزوده | Metrics |
|---|---|---|---|
| `page_view` | صفحه قابل مشاهده شد؛ نه هر render مجدد | `page_type`, `page_path_template`, `referrer_domain`, UTM allowlisted, `device_class` | بازدید، landing، قیف |
| `center_viewed` | صفحه/کارت مرکز مشاهده شد | `center_id`, `placement`, `source_page` | مشاهده مرکز→رزرو |
| `registration_started` | کاربر فرم ثبت‌نام را آغاز کرد | `entry_point`, `form_version` | رهاسازی ثبت‌نام |
| `registration_completed` | ثبت‌نام موفق از backend تأیید شد | `customer_account_id` pseudonymous, `method` | تبدیل ثبت‌نام |
| `booking_started` | اولین اقدام معتبر در جریان رزرو | `center_id`, `station_type`, `requested_start_bucket` | قیف رزرو |
| `booking_created` | backend رزرو را commit کرد | `reservation_id`, `source`, `status`, `quoted_amount`, `currency` | نرخ ایجاد؛ اگر از DB قابل‌اعتماد است event موازی لازم نیست |
| `booking_confirmed` | تغییر وضعیت به CONFIRMED موفق شد | `reservation_id`, `confirmation_method` | نرخ تأیید |
| `booking_cancelled` | لغو پذیرفته و ذخیره شد | `reservation_id`, `actor_type`, `reason_code`, `lead_time_bucket` | نرخ/علت لغو |
| `booking_completed` | وضعیت رزرو به COMPLETED تغییر کرد | `reservation_id`, `actual_duration_minutes` | تکمیل/ارزش رزرو؛ ترجیحاً از DB محاسبه شود |
| `booking_unavailable` | انتخاب زمان/ایستگاه به علت ظرفیت رد شد | `center_id`, `station_type`, `requested_time_bucket`, `reason_code` | تقاضای ازدست‌رفته |
| `payment_started` | درخواست پرداخت آغاز شد | `payment_id`, `reservation_id`, `method`, `amount_bucket` | قیف پرداخت |
| `payment_succeeded` | تأیید معتبر provider و ذخیره PAID | `payment_id`, `provider`, `currency` | موفقیت پرداخت؛ DB/provider منبع نهایی |
| `payment_failed` | شکست نهایی شناخته شد | `payment_id`, `provider`, `failure_code` مجاز | نرخ شکست |
| `refund_issued` | refund موفق نهایی شد؛ درخواست اولیه رویداد جداست | `refund_id`, `payment_id`, `amount`, `currency`, `reason_code` | نرخ/مبلغ refund |
| `gaming_session_started` | جلسه به ACTIVE رسید | `gaming_session_id`, `station_id`, `reservation_id` | شروع استفاده |
| `gaming_session_ended` | جلسه به وضعیت نهایی رسید | `gaming_session_id`, `actual_minutes`, `status`, `paused_minutes` | utilization و مدت واقعی |
| `promotion_viewed` | پیشنهاد واقعاً در viewport دیده شد | `promotion_id`, `placement`, `campaign_id` | exposure denominator |
| `promotion_redeemed` | تخفیف در رزرو نهایی اعمال شد | `promotion_id`, `reservation_id`, `discount_amount` | redemption و هزینه تخفیف |
| `waitlist_joined` | ورودی waitlist ثبت شد | `waitlist_entry_id`, `station_id`, time bucket | تقاضای بدون ظرفیت |
| `waitlist_converted` | offer به رزرو منجر شد | `waitlist_entry_id`, `reservation_id` | تبدیل waitlist |
| `notification_status_changed` | وضعیت dispatch/provider تغییر کرد | `notification_id`, `channel`, `status`, `provider_code` | تحویل پیام و عملیات |

## منبع حقیقت و تکرار
- رویداد client-side نباید منبع حقیقت پرداخت، refund یا رزرو تکمیل‌شده باشد؛ کاربر می‌تواند صفحه را ببندد یا رویداد را تکرار کند.
- برای تغییر وضعیت‌های backend از transactional outbox یا ثبت اتمیک معادل استفاده شود؛ فقط پس از commit رویداد منتشر شود.
- `event_id` و `source_record_id + event_type + transition_version` برای idempotency به‌کار روند.
- اگر هر بار تغییر وضعیت به‌صورت snapshot ذخیره می‌شود، transitionهای تکراری dedupe و زمان رخداد اصلی حفظ شود.
- رویداد `booking_created` و جدول Reservation را هم‌زمان به‌عنوان دو رزرو جمع نزنید؛ رویداد برای قیف و جدول برای شمارش نهایی است.
- رویدادهای مالی باید با provider webhook/settlement و Ledger تطبیق داده شوند.

## اتصال فعالیت ناشناس به حساب
1. یک شناسه تصادفی first-party برای session/visitor بسازید، با consent و عمر محدود متناسب با سیاست.
2. هنگام احراز هویت، فقط در صورت مجاز بودن، نگاشت `anonymous_id → customer_account_id` با زمان و منبع ثبت شود.
3. دسترسی به جدول نگاشت جدا و محدود باشد؛ analytics عمومی از شناسه pseudonymous استفاده کند.
4. از fingerprinting دستگاه یا استنتاج هویت با IP/user-agent خودداری شود.
5. داده گذشته فقط تا جایی قابل اتصال است که شناسه ناشناس پایدار و نگاشت مجاز واقعاً وجود داشته باشد؛ attribution گذشته را از رزروها حدس نزنید.
6. سیاست حذف/رضایت باید اثر خود را بر نگاشت و datasetهای مشتق‌شده مشخص کند.

## حداقل event set برای شروع
برای قیف وب: `page_view`, `center_viewed`, `registration_started`, `registration_completed`, `booking_started`, `booking_unavailable`. وضعیت نهایی booking/payment/refund/session از backend و جدول‌های موجود گرفته شود؛ فقط در صورت نبود تاریخچه کافی، event تغییر وضعیت اضافه شود. این رویکرد از ثبت clickهای بی‌هدف و دوباره‌شماری جلوگیری می‌کند.
