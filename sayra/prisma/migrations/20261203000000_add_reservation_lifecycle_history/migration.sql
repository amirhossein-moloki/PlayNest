-- CreateTable
CREATE TABLE "ReservationHistory" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fromStatus" "ReservationStatus" NOT NULL,
    "toStatus" "ReservationStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" "SessionActorType",
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationHistory_reservationId_createdAt_idx" ON "ReservationHistory"("reservationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exclusion Constraint for Reservation Overlap Prevention on Active States
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_no_overlap_active";

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_no_overlap_active"
EXCLUDE USING gist (
  "stationId" WITH =,
  tstzrange("startTime", "endTime") WITH &&
) WHERE (status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING'));
