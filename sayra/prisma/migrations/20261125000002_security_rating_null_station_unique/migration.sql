-- Prevent duplicate customer reviews when stationId IS NULL
-- PostgreSQL treats NULL != NULL in standard composite UNIQUE(reservationId, stationId).
CREATE UNIQUE INDEX IF NOT EXISTS "Rating_reservationId_null_station_key"
ON "Rating" ("reservationId")
WHERE "stationId" IS NULL;
