# راهنمای جامع معماری رسانه، رفع خطای ۴۰۴ و پیاده‌سازی تصویر پیش‌فرض (Media Resolution & Fallback Guide)

این مستند به بررسی دقیق علل وقوع خطای ۴۰۴ در دانلود فایل‌های تصاویر آپلود شده، تفکیک لایه‌های متادیتا و فایل‌های فیزیکی، و راهکارهای اعمال‌شده در بک‌اند، وب‌سرور، استوریج و فرانت‌اند می‌پردازد.

---

## ۱. کالبدشکافی مشکل (چرا نام فایل در alt درست بود اما عکس با خطای ۴۰۴ مواجه می‌شد؟)

### لایه ۱: دیتابیس و متادیتا (Metadata Layer)
هنگامی که فرانت‌اند درخواست دریافت اطلاعات رسانه‌ها را به اندپوینت زیر ارسال می‌کند:
```http
GET /public/gamingCenters/{gamingCenterSlug}/media
```
این درخواست توسط کنترلر `getPublicMedia` در `sayra/src/modules/public/media.public.controller.ts` پردازش شده و مستقیماً متادیتای ذخیره‌شده در جدول `Media` دیتابیس را برمی‌گرداند:
```json
[
  {
    "id": "cuid...",
    "url": "/uploads/421fc698-6ca2-4833-9c54-8906213f9f33.jpg",
    "thumbUrl": "/uploads/thumbnails/421fc698-6ca2-4833-9c54-8906213f9f33.jpg",
    "altText": "421fc698-6ca2-4833-9c54-8906213f9f33.jpg",
    "purpose": "GALLERY"
  }
]
```
در نتیجه کامپوننت فرانت‌اند ویژگی `alt` تگ `<img>` را با مقدار متنی معتبر پر می‌کند.

### لایه ۲: وب‌سرور و فایل استاتیک فیزیکی (Storage & Web Server Layer)
هنگامی که مرورگر برای دانلود فایل فیزیکی تصویر درخواست زیر را می‌فرستد:
```http
GET /uploads/421fc698-6ca2-4833-9c54-8906213f9f33.jpg
```
دلایل وقوع خطای ۴۰۴ عبارت بودند از:
1. **کانفیگ Nginx**: پیش از این، در فایل تنظیمات Nginx بلوک `location /uploads/` وجود نداشت و ترافیک به سمت اپلیکیشن Sayra که دایرکتوری `uploads` را سرو می‌کرد (`app.use('/uploads', express.static('uploads'))`) فوروارد نمی‌شد یا به عنوان فایل ناشناخته روت ۴۰۴ دریافت می‌کرد.
2. **عدم ماندگاری فایل روی دیسک (Docker Volume Persistence)**: بدون وجود Named Volume اختصاصی برای پوشه `uploads` در کانتینر `sayra`، با هر بار ری‌بیلد یا بازسازی کانتینر، فایل‌های ذخیره‌شده روی لایه کانتینر پاک می‌شدند در حالی که رکوردهای دیتابیس پابرجا می‌ماندند.
3. **مجوزهای دسترسی (Permissions)**: سرویس Sayra تحت کاربر `appuser` اجرا می‌شود، بنابراین دایرکتوری `uploads` باید دسترسی نوشتن و خواندن برای این کاربر را داشته باشد.

### لایه ۳: رفتار استاندارد مرورگرها
مرورگرهای وب در صورتی که نتوانند فایل تصویر را لود کنند (خطای ۴۰۴)، بر اساس استاندارد HTML آیکون تصویر شکسته (Broken Image) را کشیده و متن موجود در خصوصیت `alt` را به جای عکس نمایش می‌دهند.

---

## ۲. راهکار‌های اعمال‌شده در زیرساخت (Backend & Infra Fixes)

### الف) اتصال Nginx به بک‌اند Sayra برای مسیر `/uploads/`
در فایل `docker/nginx/conf.d/app.conf.template` مسیر `/uploads/` به سرویس بک‌اند `sayra_backend` هدایت گردید:
```nginx
# User uploads directory served via Sayra Express app
location /uploads/ {
    proxy_pass http://sayra_backend/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    expires 30d;
    add_header Cache-Control "public, no-transform";

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### ب) ایجاد و تنظیم مجوز پوشه‌های uploads در Dockerfile
در فایل `docker/Dockerfile` دایرکتوری‌های `uploads` و `uploads/thumbnails` ایجاد شده و مالکیت آن‌ها به `appuser:appuser` اختصاص داده شد:
```dockerfile
RUN mkdir -p storage/media uploads/thumbnails .adminjs \
    && chown -R appuser:appuser storage uploads .adminjs \
    && chown appuser:appuser /app
```

### ج) ماندگاری دائم با تعریف Named Volume در Docker Compose
در فایل `docker-compose.yml` ولوم اختصاصی `app_uploads` متصل گردید تا داده‌ها پایدار بمانند:
```yaml
  sayra:
    volumes:
      - app_storage:/app/storage
      - app_uploads:/app/uploads
...
volumes:
  app_uploads:
```

---

## ۳. پیاده‌سازی تصویر پیش‌فرض (Fallback Placeholder) در کامپوننت‌های فرانت‌اند

جهت تضمین تجربه کاربری عالی (UX) حتی در زمان عدم در دسترس بودن موقت یک عکس، در کامپوننت‌های فرانت‌اند (نظیر `BannerSlider` یا گالری تصاویر) از رویداد `onError` استفاده می‌شود.

### نمونه کد کامپوننت React / Next.js:

```tsx
import React, { useState } from 'react';

const DEFAULT_BANNER = '/images/default-banner.jpg'; // تصویر پیش‌فرض پروژه

interface BannerImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const SafeBannerImage: React.FC<BannerImageProps> = ({ src, alt, className }) => {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(DEFAULT_BANNER);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={hasError ? 'تصویر پیش‌فرض' : alt}
      onError={handleError}
      className={className}
      loading="lazy"
    />
  );
};
```
با این پیاده‌سازی، در صورت دریافت خطای ۴۰۴، مرورگر بلافاصله تصویر پیش‌فرض پروژه را جایگزین می‌کند و متن alt شکسته یا آیکون خرابی ظاهر نمی‌گردد.
