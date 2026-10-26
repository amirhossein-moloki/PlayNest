# ۴. موجودی نیازمندی‌های داده
این فهرست موجودی سطح کشف است. «وجود فیلد» از schema قابل اثبات است؛ کامل بودن مقدارهای تولیدی بدون اتصال به پایگاه داده قابل تأیید نیست.

## وضعیت‌های موجودی
- **قابل استفاده با اعتبارسنجی معمول:** فیلد/مدل در schema هست و معنای نسبتاً روشن دارد.
- **نیازمند تبدیل/اعتبارسنجی:** منبع موجود، ولی تعریف/واحد/زمان/رابطه نیازمند کنترل است.
- **جزئی:** مدل پایه وجود دارد اما فیلد یا تاریخچه لازم کم است.
- **جمع‌آوری نمی‌شود/شاهدی یافت نشد:** در جست‌وجوی مخزن شواهدی یافت نشد؛ عدم وجود integration بیرونی قطعی نیست.
- **ورودی ثالث:** باید از provider یا سامانه مالی/بازاریابی دریافت شود.
- **تأییدناپذیر:** runtime/مقادیر واقعی بررسی نشده‌اند.

| ID | دامنه / عنصر | نوع و نوع داده مورد انتظار | منبع فعلی/مسیر | وضعیت وجود و کیفیت | حساسیت، وابستگی و اصلاح |
|---|---|---|---|---|---|
| D-ID-001 | شناسه مرکز `gamingCenterId` | Attribute/String | `GamingCenter.id`, روابط در `sayra/prisma/schema.prisma` | موجود؛ باید تمام رکوردهای تحلیلی validate شوند | شناسه tenant؛ هر query سرور-side محدود شود |
| D-ID-002 | شناسه مشتری `customerAccountId` | Attribute/String | `CustomerAccount.id`, `Reservation` | موجود؛ هویت cross-center در مدل مرکزی است | PII link؛ در خروجی aggregate شناسه خام ندهید |
| D-ID-003 | شناسه پروفایل مرکز | Attribute/String | `CustomerProfile` | موجود | باید از CustomerAccount تفکیک شود؛ پروفایل تکراری را مشتری یکتا نشمارید |
| D-ID-004 | شناسه رزرو | Attribute/String | `Reservation.id`, `AnalyticsReservation.id` | موجود؛ upsert بر مبنای id در ingestion مستند | dedupe بر اساس شناسه منبع |
| D-ID-005 | شناسه ایستگاه | Attribute/String | `GameStation.id`, `Reservation.stationId` | موجود؛ وضعیت تاریخی در لحظه رزرو نامشخص | نیاز به تاریخچه ایستگاه/تخصیص |
| D-ID-006 | شناسه جلسه بازی | Attribute/String | `GamingSession.id` | موجود | یکتایی، رزرو nullable و جلسات walk-in را بررسی کنید |
| D-ID-007 | شناسه پرداخت و provider ref | Attribute/String | `Payment` و مدل‌های reconciliation | موجود؛ completeness و یکتایی provider ref بررسی شود | داده مالی حساس؛ از log عمومی حذف شود |
| D-ID-008 | شناسه refund و payment parent | Attribute/String | `Refund` | موجود | چند refund برای یک پرداخت و وضعیت ambiguous را پشتیبانی کنید |
| D-ID-009 | شناسه دفترکل | Attribute/String | `LedgerEntry` | موجود؛ append-only طبق مستند پرداخت | دسترسی محدود و audit؛ اصلاح با entry جبرانی |
| D-TIME-001 | زمان ایجاد/به‌روزرسانی | DateTime UTC | بیشتر مدل‌های عملیاتی | موجود در مدل‌های اصلی؛ timezone semantic نیازمند قرارداد | ذخیره UTC، نمایش timezone مرکز، تست مرز روز/DST |
| D-TIME-002 | زمان خدمت `startTime/endTime` | DateTime | Reservation/GamingSession | موجود؛ actual vs scheduled تفکیک شود | بررسی پایان null، منفی بودن مدت و هم‌پوشانی |
| D-TIME-003 | زمان پرداخت `paidAt` | DateTime nullable | Payment/AnalyticsPayment | در مستند Analytics آمده؛ بررسی دقیق schema و nullable در همه مسیرها لازم | گزارش بر اساس زمان پرداخت نه زمان رزرو |
| D-TIME-004 | زمان refund/تسویه provider | DateTime | Refund/provider settlement | بخشی از مدل refund؛ settlement بیرونی نیازمند بررسی | دریافت statement و timezone |
| D-RES-001 | وضعیت رزرو | Enum | `ReservationStatus` | موجود؛ تاریخچه وضعیت در `ReservationHistory` مستند | transitionها، لغو و no-show استاندارد شوند |
| D-RES-002 | منبع رزرو | Enum | `ReservationSource`: ONLINE/WALK_IN/PHONE | موجود | منبع کسب‌وکار با attribution کمپین یکی نیست |
| D-RES-003 | مبلغ کل و تخفیف | Float در مدل اصلی بر اساس schema موجود | `Reservation.totalPrice/discountAmount`, Analytics shadow | موجود؛ واحد و rounding ریسک مهم | بررسی مهاجرت پولی به integer minor units و ارز صریح |
| D-RES-004 | زمان شروع/پایان برنامه‌ریزی‌شده | DateTime | Reservation | موجود | تغییر زمان باید تاریخچه‌دار باشد تا lead time و تغییر رزرو دقیق شود |
| D-PAY-001 | مبلغ/ارز/وضعیت پرداخت | Integer/Enum پیشنهادی | Payment/AnalyticsPayment | مدل موجود؛ currency و سازگاری مقدار باید بررسی شود | مبلغ صحیح، currency code، idempotency key |
| D-PAY-002 | کارمزد provider | Decimal/integer + currency | در schema بررسی‌شده شاهد روشن نیافتیم | جمع‌آوری/اتصال ثالث لازم | از گزارش تسویه gateway |
| D-PAY-003 | وضعیت و مبلغ refund | Enum/Integer | Refund/AnalyticsRefund | موجود؛ statusهای SUCCESSFUL/FAILED/AMBIGUOUS | refund موفق را از درخواست refund جدا کنید |
| D-PAY-004 | جریان دفترکل | Enum/Integer + reference | LedgerEntry | موجود | تطبیق با پرداخت، refund، کیف پول و کمیسیون |
| D-CUS-001 | زمان اولین/آخرین بازدید | Derived timestamp | از Reservation COMPLETED | قابل مشتق‌سازی | تعریف بازدید و مرکز/مشتری را ثابت کنید |
| D-CUS-002 | ترجیح مشتری | Derived category | از رزرو/ایستگاه | جزئی | رفتار مشاهده‌شده است نه ترجیح اظهارشده |
| D-WEB-001 | شناسه visitor ناشناس | UUID/cookie id | شاهدی در frontend tracking یافت نشد | جمع‌آوری نامشهود/تأییدناپذیر | رضایت، عمر محدود، حذف و عدم fingerprinting |
| D-WEB-002 | شناسه session وب | UUID | شاهدی یافت نشد | جمع‌آوری لازم | چرخش شناسه، timeout، تفکیک session از شخص |
| D-WEB-003 | رویداد صفحه/قیف | Event name + timestamp + JSON properties | جست‌وجوی `page_view`, `gtag`, `booking_started` در frontend بی‌نتیجه | `DATA_COLLECTION_MISSING` بر اساس جست‌وجو | فقط رویدادهای تصمیم‌ساز، consent و retention |
| D-WEB-004 | UTM/referrer/landing/device | Nullable strings/enums | شاهدی از event tracking یافت نشد | جمع‌آوری لازم برای attribution | حذف query stringهای حاوی PII؛ allowlist پارامترها |
| D-WEB-005 | پیوند visitor به customer | link timestamp + consent/source | شاهدی یافت نشد | جمع‌آوری لازم و محدود | اتصال فقط پس از احراز/مبنای مجاز؛ عدم بازشناسی گذشته |
| D-MKT-001 | هزینه کمپین/کانال | Currency + period + campaignId | منبع درونی تأیید نشد | ورودی مالی/تبلیغاتی ثالث | هزینه واقعی، مالیات/آژانس و قواعد تخصیص |
| D-MKT-002 | مواجهه/کد کمپین | campaignId/promotionId | `Discount` موجود؛ نمایش/مواجهه مشخص نیست | جزئی | promotion viewed ≠ redeemed |
| D-STN-001 | ساعات کاری مرکز | Local time + timezone + effective dates | `GamingCenter.openingTime/closingTime` | موجود ولی فقط زمان روز؛ تاریخچه/روز هفته و تعطیلی نامعلوم | مدل schedule تاریخ‌دار و timezone IANA |
| D-STN-002 | وضعیت availability ایستگاه | status intervals | `GameStation.isActive` | جزئی؛ active به معنی قابل‌رزرو بودن در هر ساعت نیست | ثبت بازه‌های maintenance/unavailable |
| D-STN-003 | تعمیر و هزینه تعمیر | event interval + amount/currency | شاهد روشن در schema بررسی‌شده نیافتیم | جمع‌آوری لازم | علت توقف، هزینه قطعه/کار، حریم داده کم |
| D-STN-004 | قیمت تاریخی ایستگاه | effective-dated price | قیمت جاری `hourlyPrice` | جزئی؛ تاریخچه تغییر قیمت نامعلوم | جدول تغییر قیمت یا audit قابل‌تحلیل |
| D-COST-001 | هزینه مستقیم خدمت | amount/currency/category/center | شاهدی از ledger هزینه کامل نیافتیم | `DATA_COLLECTION_MISSING` | تعریف هزینه مستقیم، مرجع سند و دوره |
| D-COST-002 | هزینه عملیاتی | amount/category/period/center | شاهدی یافت نشد | `DATA_COLLECTION_MISSING` یا integration حسابداری | ثبت اجاره، حقوق، اینترنت، انرژی و سایر هزینه‌ها |
| D-COST-003 | سرمایه/استهلاک تجهیزات | purchase date/cost/useful life | شاهد کامل یافت نشد | جزئی/تأییدناپذیر | منبع دارایی ثابت؛ برای ROI لازم |
| D-STAFF-001 | شیفت برنامه‌ریزی‌شده | start/end/role/user | `StaffShift` | موجود | ساعت واقعی حضور با برنامه شیفت یکی نیست |
| D-STAFF-002 | فعالیت ثبت‌کننده | actorId + timestamp + action | `AuditLog`, Reservation creator/staff | موجود به‌صورت بخشی | ثبت یکنواخت actor، علت اصلاح، request correlation |
| D-SUP-001 | تیکت/شکایت | category/status/priority/timestamps | `Ticket` | مدل موجود؛ زمان‌های پاسخ/حل و علت refund بررسی شود | دسترسی به متن آزاد محدود؛ دسته‌بندی کمینه |
| D-EXP-001 | رضایت مشتری | rating/score/time | `Rating`, `Comment` | موجود؛ نرخ پاسخ و representativeness نامعلوم | گزارش پاسخ‌دهندگان و غیرپاسخ‌دهندگان |
| D-OPS-001 | وضعیت ingestion | run/status/count/duration/error | `AnalyticsIngestionRun`, `AnalyticsWatermark` | موجود طبق schema و endpoint | alert روی lag، شکست و افت تعداد رکورد |
| D-OPS-002 | خطای API و trace | status/latency/correlationId | logging/monitoring | وجود instrumentation سراسری تأییدناپذیر | telemetry بدون PII؛ نگهداری محدود |
| D-OPS-003 | وضعیت اعلان | channel/status/timestamps | notification dispatch/log | مدل notification و وضعیت‌ها موجود | SENT به معنی delivered/read نیست؛ provider callback لازم |
| D-PLT-001 | onboarding/فعالیت tenant | createdAt/activation events/feature use | GamingCenter/AuditLog؛ event اختصاصی نامشخص | جزئی | تعریف activation و استفاده از قابلیت، tenant isolation |
| D-PRIV-001 | رضایت و ترجیح حریم خصوصی | consent state/version/timestamp | وجود منبع عمومی تأیید نشد | `NOT_VERIFIABLE` | پیش‌نیاز tracking وب، سیاست حذف و اثبات رضایت |

## روابط داده‌ای پیشنهادی
- `GamingCenter 1—N Reservation`, `GameStation 1—N Reservation`, `CustomerAccount 1—N Reservation`.
- `Reservation 1—N Payment` و اتصال احتمالی به `GamingSession`؛ تعداد واقعی رابطه باید با schema و قواعد کسب‌وکار تطبیق داده شود.
- `Payment 1—N Refund` و ارجاع به `LedgerEntry` برای تطبیق.
- `CustomerAccount` هویت مرکزی و `CustomerProfile` رابطه در سطح مرکز است؛ از شمردن هر دو به عنوان دو مشتری اجتناب شود.
- مدل‌های `Analytics*` نسخه تحلیلی داده عملیاتی‌اند؛ lineage، تأخیر و سیاست حذف/اصلاح باید مستند شوند.

## قواعد کیفیت داده
1. شناسه‌های یکتا و foreign keyهای یتیم را روزانه کنترل کنید.
2. مبلغ‌ها، currency و واحد Rial/Toman را به‌صورت صریح اعتبارسنجی کنید.
3. تعداد source vs analytics را به تفکیک entity و وضعیت مقایسه کنید.
4. وضعیت‌های terminal رزرو/پرداخت/refund و transitionهای غیرممکن را کنترل کنید.
5. watermark و آخرین موفقیت هر entity را مانیتور کنید.
6. رویدادها idempotent باشند؛ retry باعث دوباره‌شماری نشود.
7. حذف و اصلاح منبع در shadow tables قابل بازتاب باشد.
8. اطلاعات شخصی غیرضروری (شماره تلفن کامل، IP، user-agent خام) وارد dataset تحلیلی عمومی نشود.
