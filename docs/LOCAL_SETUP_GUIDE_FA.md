# راهنمای نصب و اجرای محلی (بدون داکر) - Playenest

این راهنما برای توسعه‌دهندگانی است که مایلند پروژه Playenest را به صورت مستقیم بر روی سیستم‌عامل خود (Windows, macOS, Linux) و بدون استفاده از Docker اجرا کنند.

## پیش‌نیازها

برای اجرای پروژه، موارد زیر باید روی سیستم شما نصب باشند:

- **Node.js**: نسخه ۱۸ یا بالاتر
- **PostgreSQL**: نسخه ۱۵
- **Redis**: نسخه ۶ یا بالاتر

---

## مرحله ۱: نصب Node.js

ابتدا Node.js را از [سایت رسمی](https://nodejs.org/) دریافت و نصب کنید. برای بررسی نصب، دستور زیر را در ترمینال اجرا کنید:
```bash
node -v
npm -v
```

---

## مرحله ۲: نصب و راه‌اندازی PostgreSQL

۱. **نصب:** PostgreSQL را متناسب با سیستم‌عامل خود نصب کنید.
۲. **ایجاد دیتابیس:** وارد کنسول PostgreSQL شوید و یک دیتابیس جدید بسازید:
   ```sql
   CREATE DATABASE playenest_db;
   CREATE USER playenest_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE playenest_db TO playenest_user;
   ```
   *نکته: در نسخه‌های جدیدتر PostgreSQL، ممکن است نیاز باشد دسترسی Schema را نیز بدهید:*
   ```sql
   \c playenest_db
   GRANT ALL ON SCHEMA public TO playenest_user;
   ```

---

## مرحله ۳: نصب و راه‌اندازی Redis

۱. **Linux:** با استفاده از مدیریت پکیج (مثل `apt install redis-server`) نصب کنید.
۲. **macOS:** با استفاده از Homebrew (`brew install redis`) نصب کنید.
۳. **Windows:** می‌توانید از [Memurai](https://www.memurai.com/) استفاده کنید یا Redis را از طریق WSL نصب کنید.

سرویس Redis باید روی پورت پیش‌فرض `6379` در حال اجرا باشد.

---

## مرحله ۴: نصب وابستگی‌های پروژه

پروژه را کلون کرده و پکیج‌ها را نصب کنید:
```bash
# اگر قبلاً کلون نکرده‌اید
# git clone https://github.com/your-repo/playenest.git
# cd playenest

npm install
```

---

## مرحله ۵: تنظیم متغیرهای محیطی (Environment Variables)

فایل `.env.example` را کپی کرده و به `.env` تغییر نام دهید:
```bash
cp .env.example .env
```

سپس موارد زیر را در فایل `.env` بر اساس تنظیمات خود تغییر دهید:
```env
DATABASE_URL="postgresql://playenest_user:your_password@localhost:5432/playenest_db"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET="یک-عبارت-تصادفی-طولانی-بیش-از-۳۲-کاراکتر"
JWT_REFRESH_SECRET="یک-عبارت-تصادفی-دیگر-بیش-از-۳۲-کاراکتر"
```

---

## مرحله ۶: آماده‌سازی دیتابیس (Prisma)

برای ایجاد جداول و تولید کلاینت پریزما، دستورات زیر را اجرا کنید:
```bash
# ایجاد جداول در دیتابیس
npx prisma migrate dev --name init

# تولید کلاینت Prisma
npx prisma generate
```

---

## مرحله ۷: بارگذاری داده‌های اولیه (Seed) - اختیاری

برای تست بهتر سیستم، می‌توانید دیتابیس را با داده‌های نمونه پر کنید:
```bash
npm run db:seed
```

---

## مرحله ۸: اجرای پروژه

### حالت توسعه (Development)
در این حالت، با هر تغییر در کد، سرور به صورت خودکار ریستارت می‌شود:
```bash
npm run dev
```

### حالت تولید (Production)
برای اجرای نهایی پروژه:
```bash
# کامپایل کدهای تایپ‌اسکریپت به جاوااسکریپت
npm run build

# اجرای سرور نهایی
npm start
```

---

## عیب‌یابی (Troubleshooting)

- **خطای اتصال به دیتابیس:** مطمئن شوید سرویس PostgreSQL در حال اجراست و مشخصات در `DATABASE_URL` درست است.
- **خطای Redis:** این پروژه برای مدیریت صف‌ها و محدودیت درخواست (Rate Limiting) به Redis نیاز دارد. مطمئن شوید سرویس آن فعال است.
- **خطای Permission در Prisma:** مطمئن شوید یوزر دیتابیس دسترسی کامل (Owner) به دیتابیس دارد.

---
*آخرین بروزرسانی: فاز ۱۰*
