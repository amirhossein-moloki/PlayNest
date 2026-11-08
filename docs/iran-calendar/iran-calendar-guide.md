# Iranian Official Calendar API Guide

این مستند راهنمای استفاده و توسعه سرویس تقویم رسمی ایران (Iranian / Jalali Calendar API) در پروژه PlayNest است.

---

## 1. مرجع داده‌ها و منطق تقویم

اطلاعات تعطیلات رسمی و مناسبت‌های ملی و مذهبی بر اساس تقویم رسمی منتشرشده توسط **مرکز تقویم مؤسسه ژئوفیزیک دانشگاه تهران** استخراج و مدیریت می‌شود:
- وب‌سایت رسمی: [https://calendar.ut.ac.ir/](https://calendar.ut.ac.ir/)

محاسبات تقویم جلالی (تبدیل دقیق، سال‌های کبیسه، روزهای هفته و شماره روز سال) بر اساس کتابخانه استاندارد `jalaali-js` پیاده‌سازی شده است.

---

## 2. مشخصات API

### دریافت روزهای تقویم در یک بازه زمانی

**Endpoint:**
```http
GET /api/v1/iran-calendar/days
```

#### پارامترهای Query

| نام پارامتر | نوع | اجباری | مقدار پیش‌فرض | توضیحات |
|---|---|---|---|---|
| `from` | string | بله | - | تاریخ شروع بازه به تقویم شمسی (`YYYY-MM-DD`) |
| `to` | string | بله | - | تاریخ پایان بازه به تقویم شمسی (`YYYY-MM-DD`) |
| `includeEvents` | boolean | خیر | `true` | دریافت اطلاعات مناسبت‌ها |
| `includeHolidays` | boolean | خیر | `true` | محاسبه و دریافت وضعیت تعطیلات |

#### اعتبارسنجی‌ها و محدودیت‌ها
1. هر دو پارامتر `from` و `to` اجباری هستند.
2. فرمت تاریخ باید دقیقاً `YYYY-MM-DD` باشد.
3. مقادیر روز ماه بر اساس قوانین تقویم جلالی بررسی می‌شوند (ماه‌های ۱ تا ۶ حداکثر ۳۱ روز، ماه‌های ۷ تا ۱۱ حداکثر ۳۰ روز، و ماه ۱۲ در سال‌های عادی ۲۹ روز و در سال‌های کبیسه ۳۰ روز).
4. تاریخ `from` نباید بزرگ‌تر از `to` باشد.
5. حداکثر طول بازه ۳ سال شمسی (۱۰۹۸ روز) است. در صورت درخواست بیشتر، خطای HTTP 400 برگردانده می‌شود.

---

## 3. نمونه Request و Response

### نمونه درخواست:
```http
GET /api/v1/iran-calendar/days?from=1405-01-01&to=1405-01-05
```

### نمونه پاسخ موفق (HTTP 200 OK):
```json
{
  "calendar": "iranian",
  "from": "1405-01-01",
  "to": "1405-01-05",
  "totalDays": 5,
  "days": [
    {
      "date": "1405-01-01",
      "year": 1405,
      "month": 1,
      "monthName": "فروردین",
      "day": 1,
      "dayOfWeek": 0,
      "dayOfWeekName": "شنبه",
      "dayOfYear": 1,
      "isWeekend": false,
      "isHoliday": true,
      "holidayType": "official",
      "isToday": false,
      "relativeDay": null,
      "relativeDayName": null,
      "events": [
        {
          "title": "عید نوروز",
          "type": "national",
          "isHoliday": true,
          "source": "official_calendar",
          "verified": true
        }
      ],
      "isOfficialCalendarPublished": true
    },
    {
      "date": "1405-01-02",
      "year": 1405,
      "month": 1,
      "monthName": "فروردین",
      "day": 2,
      "dayOfWeek": 1,
      "dayOfWeekName": "یکشنبه",
      "dayOfYear": 2,
      "isWeekend": false,
      "isHoliday": true,
      "holidayType": "official",
      "isToday": false,
      "relativeDay": null,
      "relativeDayName": null,
      "events": [
        {
          "title": "عید نوروز",
          "type": "national",
          "isHoliday": true,
          "source": "official_calendar",
          "verified": true
        }
      ],
      "isOfficialCalendarPublished": true
    },
    {
      "date": "1405-01-03",
      "year": 1405,
      "month": 1,
      "monthName": "فروردین",
      "day": 3,
      "dayOfWeek": 2,
      "dayOfWeekName": "دوشنبه",
      "dayOfYear": 3,
      "isWeekend": false,
      "isHoliday": true,
      "holidayType": "official",
      "isToday": false,
      "relativeDay": null,
      "relativeDayName": null,
      "events": [
        {
          "title": "عید نوروز",
          "type": "national",
          "isHoliday": true,
          "source": "official_calendar",
          "verified": true
        }
      ],
      "isOfficialCalendarPublished": true
    },
    {
      "date": "1405-01-04",
      "year": 1405,
      "month": 1,
      "monthName": "فروردین",
      "day": 4,
      "dayOfWeek": 3,
      "dayOfWeekName": "سه‌شنبه",
      "dayOfYear": 4,
      "isWeekend": false,
      "isHoliday": true,
      "holidayType": "official",
      "isToday": false,
      "relativeDay": null,
      "relativeDayName": null,
      "events": [
        {
          "title": "عید نوروز",
          "type": "national",
          "isHoliday": true,
          "source": "official_calendar",
          "verified": true
        }
      ],
      "isOfficialCalendarPublished": true
    },
    {
      "date": "1405-01-05",
      "year": 1405,
      "month": 1,
      "monthName": "فروردین",
      "day": 5,
      "dayOfWeek": 4,
      "dayOfWeekName": "چهارشنبه",
      "dayOfYear": 5,
      "isWeekend": false,
      "isHoliday": false,
      "holidayType": "none",
      "isToday": false,
      "relativeDay": null,
      "relativeDayName": null,
      "events": [],
      "isOfficialCalendarPublished": true
    }
  ]
}
```

### نمونه پاسخ خطای اعتبارسنجی (HTTP 400 Bad Request):
```json
{
  "success": false,
  "message": "Invalid Jalali date",
  "errors": {
    "from": "The provided date is not a valid Jalali date"
  }
}
```

---

## 4. نگاشت روزهای هفته و نام ماه‌ها

### نگاشت روزهای هفته
- `0`: شنبه
- `1`: یکشنبه
- `2`: دوشنبه
- `3`: سه‌شنبه
- `4`: چهارشنبه
- `5`: پنجشنبه
- `6`: جمعه (تعطیل آخر هفته / `isWeekend: true`)

> نکته: پنجشنبه‌ها به‌صورت پیش‌فرض تعطیل رسمی در نظر گرفته نمی‌شوند (`isWeekend: false`) و تنها در صورت وجود مناسبت تعطیل، `isHoliday: true` می‌شوند. جمعه‌ها همواره `isWeekend: true` و `holidayType: "weekend"` هستند مگر اینکه مناسبت تعطیل رسمی در همان جمعه قرار گیرد که `holidayType: "official"` ارجح است.

---

## 5. نحوه وارد کردن (Import) داده‌های تقویم رسمی هر سال

برای وارد کردن اطلاعات تقویم رسمی سال‌های جدید از فایل JSON، مراحل زیر را دنبال کنید:

1. یک فایل JSON با ساختار زیر ایجاد کنید (نمونه در مسیر `sayra/src/modules/iran-calendar/data/` قرار دارد):
```json
{
  "year": 1405,
  "isOfficialCalendarPublished": true,
  "source": "official_calendar",
  "events": [
    {
      "date": "1405-01-01",
      "title": "عید نوروز",
      "type": "national",
      "isHoliday": true,
      "source": "official_calendar",
      "verified": true
    }
  ]
}
```

2. اسکریپت وارد کردن را اجرا کنید:
```bash
npx tsx sayra/scripts/import-calendar-data.ts sayra/src/modules/iran-calendar/data/calendar-1405.json
```
این اسکریپت به صورت امن عمل کرده و با بررسی کلید یکتای `[date, title]` رکوردها را Upsert می‌کند تا داده تکراری ایجاد نشود.
