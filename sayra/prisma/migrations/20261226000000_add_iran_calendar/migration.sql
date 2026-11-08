-- CreateTable CalendarYear
CREATE TABLE IF NOT EXISTS "CalendarYear" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isOfficialCalendarPublished" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT DEFAULT 'official_calendar',
    "lastSyncedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable CalendarEvent
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    "id" TEXT NOT NULL,
    "yearId" TEXT,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'official_calendar',
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarYear_year_key" ON "CalendarYear"("year");
CREATE INDEX IF NOT EXISTS "CalendarYear_year_idx" ON "CalendarYear"("year");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEvent_date_title_key" ON "CalendarEvent"("date", "title");
CREATE INDEX IF NOT EXISTS "CalendarEvent_date_idx" ON "CalendarEvent"("date");
CREATE INDEX IF NOT EXISTS "CalendarEvent_date_isHoliday_idx" ON "CalendarEvent"("date", "isHoliday");
CREATE INDEX IF NOT EXISTS "CalendarEvent_yearId_idx" ON "CalendarEvent"("yearId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_yearId_fkey'
    ) THEN
        ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_yearId_fkey"
            FOREIGN KEY ("yearId") REFERENCES "CalendarYear"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
