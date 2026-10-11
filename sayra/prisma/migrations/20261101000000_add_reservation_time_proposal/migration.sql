-- CreateEnum
CREATE TYPE "ReservationProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ReservationTimeProposal" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "originalStartTime" TIMESTAMPTZ(6) NOT NULL,
    "originalEndTime" TIMESTAMPTZ(6) NOT NULL,
    "proposedStartTime" TIMESTAMPTZ(6) NOT NULL,
    "proposedEndTime" TIMESTAMPTZ(6) NOT NULL,
    "note" TEXT,
    "status" "ReservationProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "customerRespondedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationTimeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationTimeProposal_reservationId_status_idx" ON "ReservationTimeProposal"("reservationId", "status");

-- CreateIndex
CREATE INDEX "ReservationTimeProposal_reservationId_createdAt_idx" ON "ReservationTimeProposal"("reservationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReservationTimeProposal" ADD CONSTRAINT "ReservationTimeProposal_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTimeProposal" ADD CONSTRAINT "ReservationTimeProposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
