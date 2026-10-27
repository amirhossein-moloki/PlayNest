# گزارش تحلیل ساختار سیستم مقالات در پروژه PlayNest

**تاریخ:** مارس ۲۰۲۶
**وضعیت پروژه:** عدم تغییر در کدهای اجرایی / صرفاً ایجاد فایل گزارش مستندسازی

---

## ۱. مسیر فایل‌های مرتبط (Related File Paths)

| فایل / دایرکتوری | نقش و کاربرد در معماری |
| :--- | :--- |
| `payload/src/collections/Articles.ts` | تعریف دقیق Collection مقالات در سیستم مدیریت محتوای Payload CMS |
| `payload/src/payload.config.ts` | کانفیگ مرکزی Payload CMS (تنظیم ویرایشگر Lexical، اتصال دیتابیس `payload_db` و ثبت Collectionها) |
| `payload/src/collections/Media.ts` | مدیریت فایل‌ها و تصاویر آپلودشده جهت استفاده در `heroMedia` |
| `payload/src/collections/VenueProfiles.ts` | پروفایل تحریریه‌ای گیم‌سنترها با قابلیت ارجاع متقابل |
| `payload/src/collections/CityLandingPages.ts` | صفحات فرود شهری برای نمایش گیم‌سنترها و مقالات مرتبط |
| `sayra/prisma/schema.prisma` | مدل Prisma مربوط به `Post` (وبلاگ اختصاصی درون‌گیم‌سنتری در Sayra) |
| `docker/nginx/conf.d/app.conf.template` | تنظیمات هدایت ترافیک NGINX بین `sayra` و `payload` |

---

## ۲. جدول تمام فیلدهای Collection مقالات (`Articles`)

بر اساس کدهای موجود در `payload/src/collections/Articles.ts`:

| نام فیلد (`name`) | نوع داده (`type`) | مقدار پیش‌فرض | اجباری؟ (`required`) | توضیحات و کاربرد عملیاتی |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `text` | ندارد | **بله** | عنوان اصلی مقاله (نمایش در لیست‌ها و بالای مقاله) |
| `slug` | `text` | ندارد | **بله** | شناسه متنی یکتا (`unique: true`, `index: true`) برای URL صفحه مقاله |
| `content` | `richText` | ندارد | خیر | بدنه اصلی مقاله که از ویرایشگر **Lexical Editor** استفاده می‌کند |
| `status` | `select` | `'draft'` | **بله** | وضعیت مقاله؛ گزینه‌ها: `'draft'` (پیش‌نویس) و `'published'` (منتشرشده) |
| `publishedAt` | `date` | ندارد | خیر | تاریخ و زمان دقیق انتشار مقاله (`pickerAppearance: 'dayAndTime'`) |
| `featuredVenues` | `array` | `[]` | خیر | آرایه‌ای از گیم‌سنترهای برجسته Sayra مرتبط با این مقاله |
| `featuredVenues[].sayraVenueId` | `text` | ندارد | **بله** (در هر آیتم) | شناسه CUID گیم‌سنتر در سیستم Sayra جهت یکپارچه‌سازی محتوا |
| `heroMedia` | `upload` | ندارد | خیر | تصویر کاور و اصلی مقاله (ارتباط `relationTo: 'media'`) |
| `seo` | `group` | `{}` | خیر | گروه متاداده‌های سئو شامل فیلدهای زیر |
| `seo.title` | `text` | ندارد | خیر | عنوان اختصاصی سئو جهت نمایش در گوگل و `title` صفحه |
| `seo.description` | `textarea` | ندارد | خیر | توضیحات متای سئو (`meta description`) |
| `seo.keywords` | `text` | ندارد | خیر | کلمات کلیدی سئو (تگ‌های متای مربوطه) |

---

## ۳. ساختار دقیق محتوای مقاله (`content`)

ویرایشگر کانفیگ‌شده در سطح سیستم Payload (`payload/src/payload.config.ts`) ویرایشگر **Lexical Editor** (`@payloadcms/richtext-lexical`) است.

* **فرمت ذخیره‌سازی:** داده به صورت یک شیء ساختاریافته **JSON (AST - Abstract Syntax Tree)** در دیتابیس ذخیره می‌شود.
* **ساختار ریشه (Root Structure):**
  - شیء اصلی دارای کلید `root` است.
  - `root` شامل `children` (آرایه‌ای از نودهای اصلی مانند پاراگراف، تیتر، لیست و...)، `direction`، `format`، `indent`، `type: "root"` و `version` می‌باشد.
* **نودهای استاندارد پشتیبانی‌شده در AST:**
  1. **Paragraph Node (`type: "paragraph"`):** حاوی آرایه‌ای از نودهای متنی (`children: [{ type: "text", text: "..." }]`).
  2. **Heading Node (`type: "heading"`):** برای تیترها همراه با مشخص کردن سطح تیتر (`tag: "h1" | "h2" | "h3"`).
  3. **List Node & ListItem Node (`type: "list"`, `listType: "bullet" | "number"`):** برای لیست‌های نقطه‌ای و شماره‌ای.
  4. **Text Node (`type: "text"`):** کوچک‌ترین واحد متنی که شامل خواصی چون `text` (متن)، `format` (بیت‌ماسک فرمت‌دهی: 1=Bold, 2=Italic, 8=Underline, 16=Code و...)، `detail` و `mode` است.
  5. **Upload / Block Node (`type: "upload"` / `type: "block"`):** جهت درج رسانه‌ها یا بلوک‌های تصویری درون متن.

---

## ۴. نمونه JSON واقعی و انباشته از یک مقاله (بدون اطلاعات حساس)

```json
{
  "id": "65f2a1b8c9e4b70012a34567",
  "title": "راهنمای جامع بازی‌های گروهی در گیم‌سنترهای تهران",
  "slug": "tehran-gamenet-group-games-guide",
  "status": "published",
  "publishedAt": "2026-03-01T10:00:00.000Z",
  "content": {
    "root": {
      "type": "root",
      "format": "",
      "indent": 0,
      "version": 1,
      "direction": "rtl",
      "children": [
        {
          "type": "heading",
          "tag": "h2",
          "format": "",
          "indent": 0,
          "version": 1,
          "direction": "rtl",
          "children": [
            {
              "type": "text",
              "text": "مقدمه‌ای بر بهترین تجربیات گیمینگ گروهی",
              "format": 1,
              "detail": 0,
              "mode": "normal",
              "style": "",
              "version": 1
            }
          ]
        },
        {
          "type": "paragraph",
          "format": "",
          "indent": 0,
          "version": 1,
          "direction": "rtl",
          "children": [
            {
              "type": "text",
              "text": "انتخاب یک گیم‌سنتر مناسب با تجهیزات به‌روز و فضای دوستانه می‌تواند تجربه بازی‌های چندنفره را به طور چشمگیری ارتقا دهد.",
              "format": 0,
              "detail": 0,
              "mode": "normal",
              "style": "",
              "version": 1
            }
          ]
        }
      ]
    }
  },
  "featuredVenues": [
    {
      "sayraVenueId": "cm0123456789abcdef",
      "id": "65f2a1b8c9e4b70012a34568"
    }
  ],
  "heroMedia": {
    "id": "65f2a1b8c9e4b70012a34599",
    "filename": "hero-cover.webp",
    "mimeType": "image/webp",
    "filesize": 124500,
    "width": 1200,
    "height": 630,
    "url": "/payload_media/hero-cover.webp"
  },
  "seo": {
    "title": "راهنمای بازی‌های گروهی گیم‌سنتر | PlayNest",
    "description": "معرفی بهترین گیم‌سنترها و بازی‌های چندنفره کنسول و PC در تهران.",
    "keywords": "گیم سنتر, بازی گروهی, رزرو آنلاین کنسول, PlayNest"
  },
  "createdAt": "2026-02-28T14:30:00.000Z",
  "updatedAt": "2026-03-01T10:00:00.000Z"
}
```

---

## ۵. نحوه نمایش مقاله در فرانت‌اند

1. **اندپوئینت‌های دریافت داده (API Endpoints):**
   * **Payload REST API:** `GET /api/payload/articles` (لیست مقالات) و `GET /api/payload/articles?where[slug][equals]=...` (جزئیات مقاله با اسلاگ).
   * **Payload GraphQL API:** در مسیر `/api/graphql` با کوئری `query { Articles { docs { title content ... } } }`.
2. **بررسی مسیریابی فرانت‌اند در پروژه:**
   * در فرانت‌اند فعلی (سرویس Sayra)، مسیریابی عمومی مستقیمی برای مقالات مجله عمومی Payload تعریف نشده است.
   * ارتباط NGINX به گونه‌ای پیکربندی شده که درخواست‌های `/api/payload/*` را مستقیماً به سرویس Payload (پورت ۳۰۰۰) هدایت می‌کند تا اپلیکیشن Next.js فرانت‌اند بتواند داده‌ها را رندر کند.
3. **محدودیت‌های دسترسی در خواندن (Read Access Rules):**
   * کاربران ناشناس (Public) **فقط** مقالاتی را دریافت می‌کنند که شرط `status === 'published'` روی آن‌ها برقرار باشد (`access.read` در `Articles.ts`).
   * کاربران احرازهویت‌شده پنل مدیریت Payload می‌توانند پیش‌نویس‌ها (`draft`) را نیز مشاهده کنند.

---

## ۶. تفاوت Articles و Posts (جدول مقایسه‌ای)

| معیار | `Articles` (در Payload CMS) | `Posts` (در Sayra Backend) |
| :--- | :--- | :--- |
| **سرویس مالک** | **Payload CMS** (`payload/src/collections/Articles.ts`) | **Sayra Backend** (`sayra/prisma/schema.prisma`) |
| **پایگاه داده** | `payload_db` (PostgreSQL / Drizzle ORM) | `playenest_prod` (PostgreSQL / Prisma ORM) |
| **قلمرو و محدوده (Scope)** | **عمومی و سراسری (Global Platform Level)** | **مختص به یک گیم‌سنتر (Tenant-Scoped)** |
| **ارتباط با گیم‌سنتر** | اختیاری و چندگانه از طریق آرایه `featuredVenues` | **اجباری** با ارتباط کلید خارجی مستقیم `gamingCenterId` |
| **فرمت بدنه (Content)** | **Lexical RichText (JSON AST)** | **HTML String (CKEditor / Text)** |
| **کاربرد اصلی** | مجله مارکتینگ، اخبار سراسری صنعت بازی، سئوی مرکزی و معرفی شهرها | اخبار داخلی، اطلاعیه‌ها و وبلاگ اختصاصی یک گیم‌سنتر خاص |

---

## ۷. پیشنهاد تغییرات لازم برای شخصی‌سازی و ارتقای مقالات

1. **افزودن قابلیت پیش‌نویس رسمی Payload (`versions.drafts`):**
   * در حال حاضر فیلد `status` به صورت دستی تعریف شده است. فعال‌سازی `versions: { drafts: true }` در کانفیگ Collection، امکانات قدرتمندی مثل پیش‌نمایش زنده (Live Preview) و تاریخچه ویرایش‌ها را فراهم می‌کند.
2. **افزودن دسته‌بندی و برچسب‌ها (`Categories` & `Tags`):**
   * ایجاد Collectionهای `Categories` و `Tags` در Payload و ایجاد رابطه `relationship` در `Articles` جهت ساختاردهی بهتر مجله.
3. **کامپوننت اختصاصی انتخاب گیم‌سنتر Sayra (`SayraVenueSelect`):**
   * پیاده‌سازی کامپوننت اختصاصی React جهت انتخاب زنده گیم‌سنترهای Sayra در پنل اداری Payload همراه با هوک اعتبارسنجی `beforeValidate`.
4. **افزودن فیلد نویسنده (`author`) و زمان تقریبی مطالعه (`readingTime`):**
   * اضافه کردن رابطه `author` به `Users` و یک فیلد عددی برای تخمین زمان مطالعه مقاله.
