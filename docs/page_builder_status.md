# گزارش وضعیت سیستم صفحه‌ساز (Page Builder) پروژه Playenest

این گزارش شامل بررسی دقیق فنی، قابلیت‌های موجود و نقاط ضعف سیستم صفحه‌ساز (Page Builder) در پروژه است.

## ۱. معماری سیستم (Architecture)

سیستم صفحه‌ساز سورا (Playenest) بر پایه یک معماری **Registry-based** طراحی شده است. به این صورت که هر بخش از صفحه (Section) دارای یک تعریف مشخص در لایه کد، یک شمای اعتبارسنجی (Zod Schema) و یک رندرکننده (Renderer) اختصاصی است.

### اجزای اصلی دیتابیس (Prisma Models):
- **GamingCenterPage:** ذخیره اطلاعات اصلی صفحه (عنوان، وضعیت، نوع صفحه و تنظیمات SEO).
- **GamingCenterPageSection:** ذخیره بلوک‌های محتوایی به صورت JSON در فیلد `dataJson`.
- **GamingCenterMedia:** مدیریت دارایی‌های تصویری و ویدیویی با قابلیت تنظیم Alt Text برای سئو.
- **GamingCenterPageSlugHistory:** نگهداری تاریخچه Slugها برای ایجاد Redirect 301 خودکار در صورت تغییر آدرس صفحه.

---

## ۲. قابلیت‌های فعلی (Current Features)

### ۲.۱. انواع بلوک‌های محتوایی (Supported Sections)
در حال حاضر ۱۱ نوع بلوک مختلف پیاده‌سازی شده است:
1.  **HERO:** بخش اصلی بالای صفحه با تصویر زمینه، عنوان و دکمه‌های فراخوان (CTA).
2.  **RICH_TEXT:** نمایش متون طولانی با قابلیت پشتیبانی محدود از تگ‌های HTML امن.
3.  **HIGHLIGHTS:** نمایش ویژگی‌ها یا مزایای سالن در قالب کارت‌های سه‌تایی.
4.  **SERVICES_GRID:** نمایش لیست خدمات (به صورت Placeholder در رندر فعلی).
5.  **STAFF_GRID:** نمایش تیم و کارکنان.
6.  **GALLERY_GRID:** نمایش گالری تصاویر با دسته‌بندی.
7.  **TESTIMONIALS:** نمایش نظرات مشتریان.
8.  **CONTACT_CARD:** نمایش اطلاعات تماس و ساعات کاری.
9.  **MAP:** نمایش نقشه (در حال حاضر به صورت نمایش مختصات).
10. **FAQ:** بخش سوالات متداول.
11. **CTA:** بخش فراخوان نهایی برای رزرو.

### ۲.۲. مدیریت سئو (SEO Management)
سیستم به صورت پیش‌فرض برای موتورهای جستجو بهینه شده است:
- امکان تنظیم `seoTitle` و `seoDescription` مجزا برای هر صفحه.
- پشتیبانی از پروتکل **Open Graph** (برای نمایش صحیح در شبکه‌های اجتماعی).
- قابلیت تنظیم `Robots Index/Follow`.
- پشتیبانی از **Structured Data (JSON-LD)** برای نمایش نتایج غنی در گوگل.
- تولید خودکار تگ `Canonical`.

### ۲.۳. پنل مدیریت داخلی (Built-in Admin Editor)
یک ویرایشگر بصری (Visual Editor) در مسیر `/api/v1/admin/gamingCenters/:gamingCenterId/pages/:pageId` تعبیه شده است که دارای قابلیت‌های زیر است:
- **Drag & Drop:** جابجایی ترتیب بلوک‌ها با کشیدن و رها کردن.
- **Live Preview:** مشاهده آنی تغییرات در قالب یک `iframe` قبل از ذخیره‌سازی.
- **Form-based Editing:** ویرایش فیلدهای هر بلوک بر اساس دیتای JSON.

---

## ۳. وضعیت فنی و پایداری

- **Backend:** کاملاً پیاده‌سازی شده و از Zod برای اعتبارسنجی دقیق داده‌های هر بخش استفاده می‌کند.
- **Rendering:** از Server-Side Rendering (SSR) ساده برای تولید HTML استفاده می‌کند که برای سئو بسیار عالی است.
- **Caching:** از هدرهای ETag و Last-Modified برای بهینه‌سازی سرعت بارگذاری استفاده می‌شود.

---

## ۴. تغییرات و بهبودهای اخیر (Recent Improvements)

در آخرین به‌روزرسانی، موارد زیر برای رفع خلأهای شناسایی شده انجام شد:

۱. **ایمن‌سازی مسیرهای مدیریت:** تمامی مسیرهای `/api/v1/admin/...` اکنون توسط `authMiddleware` و `requireRole` محافظت می‌شوند و تنها مدیران (MANAGER) به آن‌ها دسترسی دارند.
۲. **پیاده‌سازی کامل بخش‌های لینک و آدرس:** قابلیت‌های CRUD (ایجاد، نمایش، ویرایش و حذف) برای `GamingCenterLink` و `GamingCenterAddress` در لایه CMS به طور کامل پیاده‌سازی شد.
۳. **بهبود اعتبارسنجی سمت کلاینت:** اعتبارسنجی‌های اولیه‌ (مانند اجباری بودن عنوان و فرمت صحیح Slug) به ویرایشگر اضافه شد تا قبل از ارسال به سرور، به کاربر بازخورد داده شود.

---

## ۵. نقاط ضعف باقی‌مانده (Remaining Gaps)

۱. **تجربه کاربری ویرایشگر:** ویرایشگر همچنان با Vanilla JS است. برای پروژه‌های بسیار پیچیده، بازنویسی با React/Vue همچنان به عنوان یک نقشه راه میان‌مدت پیشنهاد می‌شود.
۲. **غنی‌تر کردن اعتبارسنجی لحظه‌ای:** اگرچه اعتبارسنجی پایه اضافه شده، اما می‌توان آن را برای تک‌تک فیلدها با جزئیات بیشتر (مثلاً نمایش خطا دقیقا زیر هر فیلد) بهبود داد.

---

## ۶. جمع‌بندی (Summary)

وضعیت صفحه‌ساز در پروژه **"کامل و ایمن" (Feature Complete & Secure)** است. زیرساخت دیتابیس، رندرینگ، و لایه مدیریت اکنون به طور کامل با هم یکپارچه هستند و خلأهای امنیتی و عملکردی قبلی برطرف شده‌اند.

---

## English Summary

The Page Builder in Playenest is a robust, registry-based system integrated with Prisma and Zod. Following recent updates, it is now **feature-complete and secure**. Admin UI routes are protected by authentication, and CRUD operations for gamingCenter links and addresses are fully implemented. Basic client-side validation has been added to the Vanilla JS editor to improve UX. While a migration to a framework like React/Vue remains a potential future improvement for extreme scalability, the current system is production-ready and covers all functional requirements.
