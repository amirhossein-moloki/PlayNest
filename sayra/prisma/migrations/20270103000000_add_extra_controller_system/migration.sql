-- AlterTable
ALTER TABLE "DeviceType" ADD COLUMN "extraControllerEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "extraControllersTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GroupBooking" ADD COLUMN "extraControllersTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BookingHold" ADD COLUMN "extraControllersTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BookingHoldItem" ADD COLUMN "extraControllersTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StationExtraController" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "controllerType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "hourlyPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationExtraController_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingHoldExtraController" (
    "id" TEXT NOT NULL,
    "bookingHoldItemId" TEXT NOT NULL,
    "extraControllerId" TEXT,
    "controllerType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "hourlyPrice" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingHoldExtraController_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationExtraController" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "extraControllerId" TEXT,
    "controllerType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "hourlyPrice" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationExtraController_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StationExtraController_stationId_controllerType_key" ON "StationExtraController"("stationId", "controllerType");

-- CreateIndex
CREATE INDEX "StationExtraController_stationId_isActive_idx" ON "StationExtraController"("stationId", "isActive");

-- CreateIndex
CREATE INDEX "StationExtraController_gamingCenterId_idx" ON "StationExtraController"("gamingCenterId");

-- CreateIndex
CREATE INDEX "BookingHoldExtraController_bookingHoldItemId_idx" ON "BookingHoldExtraController"("bookingHoldItemId");

-- CreateIndex
CREATE INDEX "BookingHoldExtraController_extraControllerId_idx" ON "BookingHoldExtraController"("extraControllerId");

-- CreateIndex
CREATE INDEX "ReservationExtraController_reservationId_idx" ON "ReservationExtraController"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationExtraController_extraControllerId_idx" ON "ReservationExtraController"("extraControllerId");

-- AddForeignKey
ALTER TABLE "StationExtraController" ADD CONSTRAINT "StationExtraController_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationExtraController" ADD CONSTRAINT "StationExtraController_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHoldExtraController" ADD CONSTRAINT "BookingHoldExtraController_bookingHoldItemId_fkey" FOREIGN KEY ("bookingHoldItemId") REFERENCES "BookingHoldItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHoldExtraController" ADD CONSTRAINT "BookingHoldExtraController_extraControllerId_fkey" FOREIGN KEY ("extraControllerId") REFERENCES "StationExtraController"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationExtraController" ADD CONSTRAINT "ReservationExtraController_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationExtraController" ADD CONSTRAINT "ReservationExtraController_extraControllerId_fkey" FOREIGN KEY ("extraControllerId") REFERENCES "StationExtraController"("id") ON DELETE SET NULL ON UPDATE CASCADE;
