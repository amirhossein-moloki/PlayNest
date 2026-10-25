-- CreateTable
CREATE TABLE "AnalyticsWatermark" (
    "entity" TEXT NOT NULL,
    "lastIngestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
    "lastSourceId" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AnalyticsWatermark_pkey" PRIMARY KEY ("entity")
);

-- CreateTable
CREATE TABLE "AnalyticsIngestionRun" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsIngested" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "watermarkBefore" TIMESTAMPTZ(6),
    "watermarkAfter" TIMESTAMPTZ(6),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsTenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pcCount" INTEGER NOT NULL DEFAULT 0,
    "consoleCount" INTEGER NOT NULL DEFAULT 0,
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceCreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceUpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ingestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsCustomer" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "phone" TEXT NOT NULL,
    "fullName" TEXT,
    "walletBalance" INTEGER NOT NULL DEFAULT 0,
    "sourceCreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceUpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ingestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsStation" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stationType" "GameStationType" NOT NULL DEFAULT 'PC',
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "hourlyPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceCreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceUpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ingestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsReservation" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentState" "ReservationPaymentState" NOT NULL DEFAULT 'UNPAID',
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "ReservationSource" NOT NULL DEFAULT 'WALK_IN',
    "sourceCreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceUpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ingestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsGamingSession" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "reservationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6),
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "GamingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedMinutes" INTEGER NOT NULL DEFAULT 0,
    "sourceCreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceUpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ingestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsGamingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsPayment" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "reservationId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE',
    "paidAt" TIMESTAMPTZ(6),
    "sourceCreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceUpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ingestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsLedgerEntry" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT,
    "refundId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "sourceCreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ingestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsRefund" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMPTZ(6),
    "sourceCreatedAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceUpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ingestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsIngestionRun_entity_startedAt_idx" ON "AnalyticsIngestionRun"("entity", "startedAt");
CREATE INDEX "AnalyticsIngestionRun_status_startedAt_idx" ON "AnalyticsIngestionRun"("status", "startedAt");
CREATE INDEX "AnalyticsTenant_slug_idx" ON "AnalyticsTenant"("slug");
CREATE INDEX "AnalyticsTenant_isActive_idx" ON "AnalyticsTenant"("isActive");
CREATE INDEX "AnalyticsCustomer_phone_idx" ON "AnalyticsCustomer"("phone");
CREATE INDEX "AnalyticsCustomer_gamingCenterId_idx" ON "AnalyticsCustomer"("gamingCenterId");
CREATE INDEX "AnalyticsStation_gamingCenterId_isActive_idx" ON "AnalyticsStation"("gamingCenterId", "isActive");
CREATE INDEX "AnalyticsReservation_gamingCenterId_startTime_idx" ON "AnalyticsReservation"("gamingCenterId", "startTime");
CREATE INDEX "AnalyticsReservation_gamingCenterId_status_startTime_idx" ON "AnalyticsReservation"("gamingCenterId", "status", "startTime");
CREATE INDEX "AnalyticsReservation_customerAccountId_startTime_idx" ON "AnalyticsReservation"("customerAccountId", "startTime");
CREATE INDEX "AnalyticsGamingSession_reservationId_idx" ON "AnalyticsGamingSession"("reservationId");
CREATE INDEX "AnalyticsGamingSession_stationId_startTime_idx" ON "AnalyticsGamingSession"("stationId", "startTime");
CREATE INDEX "AnalyticsGamingSession_gamingCenterId_idx" ON "AnalyticsGamingSession"("gamingCenterId");
CREATE INDEX "AnalyticsPayment_gamingCenterId_status_paidAt_idx" ON "AnalyticsPayment"("gamingCenterId", "status", "paidAt");
CREATE INDEX "AnalyticsPayment_reservationId_idx" ON "AnalyticsPayment"("reservationId");
CREATE INDEX "AnalyticsLedgerEntry_gamingCenterId_sourceCreatedAt_idx" ON "AnalyticsLedgerEntry"("gamingCenterId", "sourceCreatedAt");
CREATE INDEX "AnalyticsLedgerEntry_paymentId_idx" ON "AnalyticsLedgerEntry"("paymentId");
CREATE INDEX "AnalyticsLedgerEntry_entryType_idx" ON "AnalyticsLedgerEntry"("entryType");
CREATE INDEX "AnalyticsRefund_gamingCenterId_status_sourceCreatedAt_idx" ON "AnalyticsRefund"("gamingCenterId", "status", "sourceCreatedAt");
CREATE INDEX "AnalyticsRefund_paymentId_idx" ON "AnalyticsRefund"("paymentId");
