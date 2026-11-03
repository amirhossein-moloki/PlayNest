# گزارش بررسی جامع و طراحی معماری یکپارچه‌سازی PlayNest و Blog

## ۱. وضعیت فعلی هر دو پروژه (Phase 1 Audit Report)

### ۱.۱. وضعیت پروژه اصلی: PlayNest (`sayra/`)
- **تکنولوژی و فریم‌ورک:** Node.js (v22), TypeScript, Express.js, Prisma ORM (v5).
- **سرویس اصلی کانتینر:** `sayra` در پورت داخلی `3000`. بیلد با `docker/Dockerfile` (چندمرحله‌ای).
- **پایگاه داده:** PostgreSQL 15-alpine (`db`). نام دیتابیس پیش‌فرض `playenest_prod`، کاربر `playenest_admin`. دارای حجم دائمی `postgres_data`. دارای اسکریپت `init-multiple-dbs.sh` در دایرکتوری `/docker-entrypoint-initdb.d/` برای ساخت چندین دیتابیس به صورت خودکار از طریق متغیر `POSTGRES_MULTIPLE_DATABASES`.
- **کش و صف‌ها:** Redis 7-alpine (`redis`) با حجم `redis_data`. ارتباط کانتینرها از طریق `redis://redis:6379`.
- **پروکسی و وب سرور مرکزی:** Nginx stable-alpine (`nginx`) بر پایه `docker/nginx/Dockerfile` و قالب تنظیمات `docker/nginx/conf.d/app.conf.template` پردازش‌شده با `envsubst`. پورت منتشر شده خارجی: `80:80`.
- **سیستم پشتیبان‌گیری (BDR):** کانتینر مستقل `backup` با Restic و اسکریپت‌های شل در `docker/backup/scripts/` (`backup-perform.sh`, `backup-db.sh`, `restore.sh`, `maintenance.sh`) با حجم‌های `backup_data` و مسیر محلی `./backups`. این اسکریپت در حال حاضر متغیر `POSTGRES_MULTIPLE_DATABASES` را برای تهیه دامپ فشرده از چندین دیتابیس پشتیبانی می‌کند.
- **فایل‌ها و رسانه‌ها:** حجم دائمی `app_storage` متصل به `/app/storage` در Sayra و روت `/media` در Nginx.

### ۱.۲. وضعیت پروژه وبلاگ: Blog (`Blog/` - Git Submodule)
- **تکنولوژی و فریم‌ورک:** Python 3.12, Django 5.2, Django REST Framework, Daphne (ASGI) / Gunicorn (WSGI), Celery, Channels.
- **سرویس وب:** کانتینر `web` با اجرای اسکریپت `docker-entrypoint.sh` که دستورات `migrate`، `collectstatic` و در نهایت `daphne -b 0.0.0.0 -p 8000 blog.asgi:application` را اجرا می‌کند.
- **سرویس‌های پس‌زمینه (Celery):**
  - `celery_high_priority`
  - `celery_default`
  - `celery_low_priority`
  - `celery-beat`
- **پایگاه داده در تنظیمات مستقل قبلی:** PostgreSQL 14 با متغیر `DATABASE_URL` (یا متغیرهای مجزای `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`). از `dj-database-url` در `blog/settings.py` پشتیبانی می‌کند.
- **کش و صف‌ها در تنظیمات مستقل قبلی:** Redis 7.2-alpine با پورت داخلی `6379`. در `blog/settings.py` از متغیر `REDIS_URL` و `USE_REDIS` استفاده می‌شود (DB 0 برای Channels/Celery و DB 1 برای Django Cache).
- **استاتیک و رسانه:** دایرکتوری‌های `staticfiles/` و `media/` با حجم‌های `static_volume` و `media_volume`.
- **تنظیمات Nginx داخلی بلاگ:** یک سرویس مجزای Nginx با پورت متداخل `80:80` در `Blog/docker-compose.yml` که باید در معماری یکپارچه حذف شده و هدایت آن به Nginx مرکزی منتقل گردد.

---

## ۲. مشکلات، ناسازگاری‌ها و تداخل‌های شناسایی‌شده

1. **تداخل پورت 80:** هر دو فایل `docker-compose.yml` در ریشه PlayNest و داخل `Blog/` پورت `80:80` را به سمت هاست Publish می‌کردند. سرویس Nginx داخلی بلاگ باید به طور کامل کنار گذاشته شود و Nginx مرکزی تنها نقطه ورود باشد.
2. **عدم انزوای پایگاه داده و کاربر:** هر دو پروژه نباید به یک دیتابیس وصل شوند. اگر از سرور PostgreSQL مشترک استفاده شود، باید دیتابیس مجزای `blog_prod` و ترجیحاً کاربر مجزا یا دسترسی امن ایجاد شود و مایگریشن‌های جنگو صرفاً روی دیتابیس وبلاگ اعمال شوند.
3. **عدم انزوای Redis:** در صورتی که هر دو سرویس به یک Redis متصل شوند، ممکن است تداخل کلیدها (Key collision) یا تداخل در صف‌های Celery و BullMQ/ioredis رخ دهد. راهکار اصولی: استفاده از سرویس مستقل Redis برای Blog (`redis_blog` یا `blog_redis`) یا ایزولاسیون کامل با DB index و Key prefix. برای استقلال کامل و عدم ریسک خطای حافظه/اورفلو، ایجاد یک کانتینر مجزای سبک `blog_redis` روی شبکه داخلی امن‌ترین راهکار است.
4. **مسیرهای Static و Media وبلاگ:** وبلاگ فایل‌های استاتیک و رسانه‌ای خود را در حجم‌های داکر نگه می‌دارد. Nginx مرکزی باید این حجم‌ها را به صورت Read-Only متصل کرده و روی دامنه‌ی وبلاگ در مسیرهای `/static/` و `/media/` سرو کند.
5. **ارتباط Nginx مرکزی با سرور ASGI/WSGI وبلاگ:** Nginx باید درخواست‌های `blog.playnest.com` را به سمت سرویس `blog_web` (روی پورت ۸۰۰۰) ارسال کند و پروتکل‌های WebSocket (Upgrade / Connection) را نیز پشتیبانی کند چون بلاگ از Django Channels استفاده می‌کند.
6. **مایگریشن‌ها و وابستگی‌های راه‌اندازی:** سرویس `blog_web` باید منتظر بماند تا پایگاه داده سالم (Healthy) شود، سپس مایگریشن‌ها را روی دیتابیس اختصاصی وبلاگ اعمال کند.

---

## ۳. معماری پیشنهادی نهایی (Proposed Architecture)

```text
                           Internet
                              |
                     Ports: 80, 443 (HTTP/HTTPS)
                              |
                    +-------------------+
                    |   Nginx مرکزی     |
                    | (PlayNest Nginx)  |
                    +---------+---------+
                              |
         +--------------------+--------------------+
         | (Host: playnest.com)                    | (Host: blog.playnest.com)
         v                                         v
+------------------+                      +------------------+
|   sayra (Node)   |                      |  blog_web (Daphne|
|   Port: 3000     |                      |   Gunicorn/ASGI) |
+--------+---------+                      |   Port: 8000     |
         |                                +--------+---------+
         |                                         |
  +------+------+                           +------+------+
  |             |                           |             |
  v             v                           v             v
+----+       +----+                       +----+       +----+
| DB |       |Redis|                      | DB |       |Redis|
|(pg)|       |(app)|                      |(pg)|       |(app)|
+----+       +----+                       +----+       +----+
[playenest_prod] [db:0]                  [blog_prod]  [db:0/1]
```

### استراتژی پایگاه داده:
از کانتینر قدرتمند و تثبیت‌شده‌ی PostgreSQL موجود (`db`) استفاده می‌شود. با تنظیم `POSTGRES_MULTIPLE_DATABASES=blog_prod` در فایل متغیرهای محیطی، اسکریپت `init-multiple-dbs.sh` به صورت خودکار دیتابیس مجزای `blog_prod` را در صورت عدم وجود می‌سازد. به این ترتیب حجم `postgres_data` دست‌نخورده باقی می‌ماند، داده‌های قبلی حفظ می‌شوند و مایگریشن‌های Prisma و Django کاملاً روی دو دیتابیس مجزا اعمال می‌شوند.

### استراتژی Redis:
برای جلوگیری از هرگونه تداخل صفوف، دیتابیس‌ها و کش بین Sayra و سیستم چندصفی Celery/Channels در وبلاگ، یک کانتینر مستقل `blog_redis` (بر پایه `redis:7-alpine`) با حجم اختصاصی `blog_redis_data` اضافه می‌شود. هیچ پورتی از این سرویس‌ها به اینترنت اکسپوز نمی‌گردد.

### استراتژی Nginx:
قالب Nginx (`docker/nginx/conf.d/app.conf.template`) به دو بخش Virtual Host مجزا تقسیم می‌شود:
1. `server_name playnest.com www.playnest.com;` (و fallback پیش‌فرض `_`): ارسال ترافیک به `sayra_backend:3000` و سرو رسانه‌های Sayra از `/app/storage`.
2. `server_name blog.playnest.com;`: ارسال ترافیک به `blog_backend:8000` (با پشتیبانی کامل WebSocket برای Channels) و سرو مستقیم فایل‌های `staticfiles` و `media` بلاگ با Alias از حجم‌های اشتراکی.

### استراتژی پشتیبان‌گیری:
اسکریپت `docker/backup/scripts/backup-db.sh` هم‌اکنون به دلیل وجود حلقه بر روی متغیر `POSTGRES_MULTIPLE_DATABASES`، از تمام دیتابیس‌ها (شامل `playenest_prod` و `blog_prod`) بکاپ مجزا تهیه می‌کند. همچنین حجم‌های استاتیک و رسانه‌ی بلاگ به اسکریپت پشتیبان‌گیری Restic اضافه می‌شوند تا سیستم BDR کل پلتفرم یکپارچه عمل کند.

---

## ۴. فهرست فایل‌هایی که باید ویرایش یا ایجاد شوند

1. `docker-compose.yml`:
   - افزودن سرویس‌های Blog (`blog_web`, `blog_celery_default`, `blog_celery_high`, `blog_celery_low`, `blog_celery_beat`, `blog_redis`).
   - افزودن حجم‌های مستقل `blog_redis_data`, `blog_static`, `blog_media`.
   - اتصال حجم‌های `blog_static` و `blog_media` به سرویس Nginx به صورت `ro`.
   - افزودن وابستگی‌های سالم‌بودن (Depends On Healthcheck).
2. `docker-compose.dev.yml`:
   - به‌روزرسانی پیکربندی محیط توسعه برای اجرای هماهنگ Sayra و Blog.
3. `docker/nginx/conf.d/app.conf.template`:
   - بازنویسی جهت تفکیک دو دامنه `playnest.com` و `blog.playnest.com` با بلوک‌های مجزا، هدرهای استاندارد پراکسی و هندل کردن فایل‌های استاتیک و مدیا.
4. `.env.example`:
   - افزودن متغیرهای عمومی استاندارد وبلاگ (`BLOG_DOMAIN`, `POSTGRES_MULTIPLE_DATABASES`, `BLOG_SECRET_KEY`, و غیره) بدون هیچ مقدار محرمانه.
5. `docker/backup/scripts/backup-perform.sh` و `restore.sh`:
   - افزودن مسیرهای مدیا و RDB ردیس بلاگ به عملیات پشتیبان‌گیری و بازیابی Restic.
6. `NGINX_INTEGRATION_GUIDE.md` و `README.md`:
   - مستندسازی کامل معماری یکپارچه، متغیرهای مورد نیاز، نحوه اجرای داکر کامپوز، روش کار بکاپ‌گیری و چرخه توسعه.
