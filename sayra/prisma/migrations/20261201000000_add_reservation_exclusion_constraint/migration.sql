-- Enable btree_gist extension required for tstzrange and equality scalar column exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add PostgreSQL EXCLUDE constraint on Reservation table to prevent overlapping active reservations on the same station
-- Uses half-open interval tstzrange(startTime, endTime, '[)') where [ = inclusive start, ) = exclusive end for timestamptz columns
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_no_overlap_active"
EXCLUDE USING gist (
  "stationId" WITH =,
  tstzrange("startTime", "endTime", '[)') WITH &&
)
WHERE (status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING'));
