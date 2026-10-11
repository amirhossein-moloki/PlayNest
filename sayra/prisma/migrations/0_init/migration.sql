-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'SUPERVISOR', 'STAFF', 'TRAINEE', 'SUPPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ShiftRole" AS ENUM ('CASHIER', 'TECH_SUPPORT', 'CLEANER', 'HOST', 'SECURITY');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('ONLINE', 'WALK_IN', 'PHONE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE', 'GIFT_CARD', 'MEMBERSHIP');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'VOID', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReservationPaymentState" AS ENUM ('UNPAID', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'OVERPAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('HOME', 'ABOUT', 'SERVICES', 'GALLERY', 'TEAM', 'CONTACT', 'CUSTOM', 'TOURNAMENT', 'BLOG');

-- CreateEnum
CREATE TYPE "PageSectionType" AS ENUM ('HERO', 'RICH_TEXT', 'HIGHLIGHTS', 'SERVICES_GRID', 'STAFF_GRID', 'GALLERY_GRID', 'TESTIMONIALS', 'CONTACT_CARD', 'MAP', 'FAQ', 'CTA');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('COVER', 'GALLERY', 'STATION', 'LOGO');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'WEBSITE', 'PHONE', 'GOOGLE_MAP');

-- CreateEnum
CREATE TYPE "RatingStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "RobotsIndex" AS ENUM ('INDEX', 'NOINDEX');

-- CreateEnum
CREATE TYPE "RobotsFollow" AS ENUM ('FOLLOW', 'NOFOLLOW');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'ACCRUED', 'CHARGED', 'WAIVED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CommissionPaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "CommissionPaymentStatus" AS ENUM ('PENDING', 'PAID', 'VOID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SessionActorType" AS ENUM ('USER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'SIGNUP');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "GameStationType" AS ENUM ('PC', 'PLAYSTATION', 'XBOX', 'SWITCH', 'VR');

-- CreateEnum
CREATE TYPE "GamingSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'INTERRUPTED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BASIC', 'INTERMEDIATE', 'EXPERT');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('REFUND', 'RESERVATION_PAYMENT', 'DEPOSIT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('TECHNICAL', 'FINANCIAL', 'SALES', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "TicketSenderType" AS ENUM ('USER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'STRIPE', 'ZARINPAL');

-- CreateTable
CREATE TABLE "GamingCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "pcCount" INTEGER NOT NULL DEFAULT 0,
    "consoleCount" INTEGER NOT NULL DEFAULT 0,
    "openingTime" TEXT,
    "closingTime" TEXT,
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vipHourlyRate" DOUBLE PRECISION,
    "hasFoodService" BOOLEAN NOT NULL DEFAULT false,
    "games" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamingCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "preventOverlaps" BOOLEAN NOT NULL DEFAULT true,
    "timeZone" TEXT,
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    "allowOnlineBooking" BOOLEAN NOT NULL DEFAULT false,
    "onlineBookingAutoConfirm" BOOLEAN NOT NULL DEFAULT false,
    "requireOtpForPublicBooking" BOOLEAN NOT NULL DEFAULT false,
    "maxAdvanceBookingDays" INTEGER NOT NULL DEFAULT 7,
    "cancellationHours" INTEGER NOT NULL DEFAULT 2,
    "noShowPenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoReleaseUnpaidMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" "TicketCategory" NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" "TicketSenderType" NOT NULL,
    "text" TEXT NOT NULL,
    "attachment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "actorType" "SessionActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "channel" "OtpChannel" NOT NULL DEFAULT 'SMS',
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,
    "targetActorType" "SessionActorType",
    "targetActorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fullName" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "walletBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "displayName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameStation" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stationType" "GameStationType" NOT NULL DEFAULT 'PC',
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "hourlyPrice" DOUBLE PRECISION NOT NULL,
    "minRentHours" INTEGER NOT NULL DEFAULT 1,
    "maxRentHours" INTEGER NOT NULL DEFAULT 8,
    "defaultDurationHours" INTEGER NOT NULL DEFAULT 1,
    "incrementMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffStationSkill" (
    "userId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL DEFAULT 'BASIC',

    CONSTRAINT "StaffStationSkill_pkey" PRIMARY KEY ("userId","stationId")
);

-- CreateTable
CREATE TABLE "StaffShift" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "shiftRole" "ShiftRole" NOT NULL DEFAULT 'HOST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "staffId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "stationSnapshot" JSONB NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voucherCode" TEXT,
    "paymentState" "ReservationPaymentState" NOT NULL DEFAULT 'UNPAID',
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "ReservationSource" NOT NULL DEFAULT 'WALK_IN',
    "note" TEXT,
    "canceledAt" TIMESTAMPTZ(6),
    "cancelReason" TEXT,
    "canceledByUserId" TEXT,
    "completedAt" TIMESTAMPTZ(6),
    "noShowAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "providerPaymentId" TEXT,
    "providerCheckoutId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "failureReason" TEXT,
    "rawProviderPayload" JSONB,
    "idempotencyKey" TEXT,
    "paidAt" TIMESTAMPTZ(6),
    "method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE',
    "referenceCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "stationId" TEXT,
    "cleanlinessRating" INTEGER NOT NULL DEFAULT 5,
    "equipmentRating" INTEGER NOT NULL DEFAULT 5,
    "staffRating" INTEGER NOT NULL DEFAULT 5,
    "priceValueRating" INTEGER NOT NULL DEFAULT 5,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "RatingStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPolicy" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "type" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "percentBps" INTEGER,
    "fixedAmount" INTEGER,
    "currency" TEXT,
    "applyToOnlineOnly" BOOLEAN NOT NULL DEFAULT true,
    "minimumFeeAmount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Earning" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "baseAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "type" "CommissionType" NOT NULL,
    "percentBps" INTEGER,
    "fixedAmount" INTEGER,
    "commissionAmount" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMPTZ(6),
    "chargedAt" TIMESTAMPTZ(6),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Earning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningPayment" (
    "id" TEXT NOT NULL,
    "earningId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CommissionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "CommissionPaymentMethod",
    "paidAt" TIMESTAMPTZ(6),
    "referenceCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarningPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "defaultSeoTitle" TEXT,
    "defaultSeoDescription" TEXT,
    "defaultOgImageUrl" TEXT,
    "googleSiteVerification" TEXT,
    "analyticsTag" TEXT,
    "robotsIndex" "RobotsIndex" NOT NULL DEFAULT 'INDEX',
    "robotsFollow" "RobotsFollow" NOT NULL DEFAULT 'FOLLOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PageType" NOT NULL DEFAULT 'CUSTOM',
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(6),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalPath" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImageUrl" TEXT,
    "robotsIndex" "RobotsIndex" NOT NULL DEFAULT 'INDEX',
    "robotsFollow" "RobotsFollow" NOT NULL DEFAULT 'FOLLOW',
    "structuredDataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" "PageSectionType" NOT NULL,
    "dataJson" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "purpose" "MediaPurpose" NOT NULL DEFAULT 'GALLERY',
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "altText" TEXT,
    "category" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLink" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "type" "LinkType" NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "title" TEXT,
    "province" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "addressLine" TEXT NOT NULL,
    "postalCode" TEXT,
    "lat" DECIMAL(65,30),
    "lng" DECIMAL(65,30),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSlugHistory" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingCenterAnalytics" (
    "gamingCenterId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalReservations" INTEGER NOT NULL DEFAULT 0,
    "completedReservations" INTEGER NOT NULL DEFAULT 0,
    "canceledReservations" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "realizedCash" INTEGER NOT NULL DEFAULT 0,
    "peakHours" JSONB,
    "occupancyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamingCenterAnalytics_pkey" PRIMARY KEY ("gamingCenterId","date")
);

-- CreateTable
CREATE TABLE "StaffAnalytics" (
    "gamingCenterId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completedReservations" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "totalRating" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "reservationsHandled" INTEGER NOT NULL DEFAULT 0,
    "cancellationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAnalytics_pkey" PRIMARY KEY ("gamingCenterId","staffId","date")
);

-- CreateTable
CREATE TABLE "StationAnalytics" (
    "gamingCenterId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completedReservations" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "totalHoursBooked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilizationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationAnalytics_pkey" PRIMARY KEY ("gamingCenterId","stationId","date")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "reservationId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "userId" TEXT,
    "customerId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingSession" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "GamingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedAt" TIMESTAMP(3),
    "pausedMinutes" INTEGER NOT NULL DEFAULT 0,
    "interruptionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationMaintenance" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "benefits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "gameName" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "prizePool" TEXT,
    "maxParticipants" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamingCenter_slug_key" ON "GamingCenter"("slug");

-- CreateIndex
CREATE INDEX "GamingCenter_slug_idx" ON "GamingCenter"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_gamingCenterId_key" ON "Settings"("gamingCenterId");

-- CreateIndex
CREATE INDEX "Ticket_customerAccountId_idx" ON "Ticket"("customerAccountId");

-- CreateIndex
CREATE INDEX "Ticket_assignedToUserId_idx" ON "Ticket"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- CreateIndex
CREATE INDEX "Ticket_category_idx" ON "Ticket"("category");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "User_gamingCenterId_role_idx" ON "User"("gamingCenterId", "role");

-- CreateIndex
CREATE INDEX "User_gamingCenterId_isActive_idx" ON "User"("gamingCenterId", "isActive");

-- CreateIndex
CREATE INDEX "User_gamingCenterId_isPublic_idx" ON "User"("gamingCenterId", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "User_gamingCenterId_phone_key" ON "User"("gamingCenterId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_actorType_actorId_expiresAt_idx" ON "Session"("actorType", "actorId", "expiresAt");

-- CreateIndex
CREATE INDEX "PhoneOtp_phone_purpose_expiresAt_idx" ON "PhoneOtp"("phone", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "PhoneOtp_phone_createdAt_idx" ON "PhoneOtp"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneOtp_consumedAt_idx" ON "PhoneOtp"("consumedAt");

-- CreateIndex
CREATE INDEX "PhoneOtp_targetActorType_targetActorId_idx" ON "PhoneOtp"("targetActorType", "targetActorId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_phone_key" ON "CustomerAccount"("phone");

-- CreateIndex
CREATE INDEX "CustomerAccount_phone_idx" ON "CustomerAccount"("phone");

-- CreateIndex
CREATE INDEX "CustomerProfile_gamingCenterId_displayName_idx" ON "CustomerProfile"("gamingCenterId", "displayName");

-- CreateIndex
CREATE INDEX "CustomerProfile_customerAccountId_idx" ON "CustomerProfile"("customerAccountId");

-- CreateIndex
CREATE INDEX "CustomerProfile_gamingCenterId_createdAt_idx" ON "CustomerProfile"("gamingCenterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_gamingCenterId_customerAccountId_key" ON "CustomerProfile"("gamingCenterId", "customerAccountId");

-- CreateIndex
CREATE INDEX "GameStation_gamingCenterId_isActive_idx" ON "GameStation"("gamingCenterId", "isActive");

-- CreateIndex
CREATE INDEX "GameStation_gamingCenterId_name_idx" ON "GameStation"("gamingCenterId", "name");

-- CreateIndex
CREATE INDEX "StaffStationSkill_stationId_idx" ON "StaffStationSkill"("stationId");

-- CreateIndex
CREATE INDEX "StaffStationSkill_userId_idx" ON "StaffStationSkill"("userId");

-- CreateIndex
CREATE INDEX "StaffShift_gamingCenterId_dayOfWeek_idx" ON "StaffShift"("gamingCenterId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "StaffShift_gamingCenterId_userId_dayOfWeek_key" ON "StaffShift"("gamingCenterId", "userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Reservation_gamingCenterId_startTime_idx" ON "Reservation"("gamingCenterId", "startTime");

-- CreateIndex
CREATE INDEX "Reservation_gamingCenterId_staffId_startTime_idx" ON "Reservation"("gamingCenterId", "staffId", "startTime");

-- CreateIndex
CREATE INDEX "Reservation_gamingCenterId_status_startTime_idx" ON "Reservation"("gamingCenterId", "status", "startTime");

-- CreateIndex
CREATE INDEX "Reservation_gamingCenterId_staffId_status_startTime_endTime_idx" ON "Reservation"("gamingCenterId", "staffId", "status", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Reservation_customerAccountId_startTime_idx" ON "Reservation"("customerAccountId", "startTime");

-- CreateIndex
CREATE INDEX "Reservation_customerProfileId_startTime_idx" ON "Reservation"("customerProfileId", "startTime");

-- CreateIndex
CREATE INDEX "Reservation_gamingCenterId_paymentState_startTime_idx" ON "Reservation"("gamingCenterId", "paymentState", "startTime");

-- CreateIndex
CREATE INDEX "Payment_reservationId_paidAt_idx" ON "Payment"("reservationId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_gamingCenterId_status_paidAt_idx" ON "Payment"("gamingCenterId", "status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gamingCenterId_idempotencyKey_key" ON "Payment"("gamingCenterId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Rating_gamingCenterId_status_createdAt_idx" ON "Rating"("gamingCenterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_stationId_status_createdAt_idx" ON "Rating"("stationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_reservationId_idx" ON "Rating"("reservationId");

-- CreateIndex
CREATE INDEX "Rating_customerAccountId_createdAt_idx" ON "Rating"("customerAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_reservationId_stationId_key" ON "Rating"("reservationId", "stationId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPolicy_gamingCenterId_key" ON "CommissionPolicy"("gamingCenterId");

-- CreateIndex
CREATE INDEX "CommissionPolicy_gamingCenterId_isActive_idx" ON "CommissionPolicy"("gamingCenterId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Earning_reservationId_key" ON "Earning"("reservationId");

-- CreateIndex
CREATE INDEX "Earning_gamingCenterId_status_createdAt_idx" ON "Earning"("gamingCenterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Earning_chargedAt_idx" ON "Earning"("chargedAt");

-- CreateIndex
CREATE INDEX "EarningPayment_earningId_paidAt_idx" ON "EarningPayment"("earningId", "paidAt");

-- CreateIndex
CREATE INDEX "EarningPayment_status_paidAt_idx" ON "EarningPayment"("status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSettings_gamingCenterId_key" ON "SiteSettings"("gamingCenterId");

-- CreateIndex
CREATE INDEX "Page_gamingCenterId_status_idx" ON "Page"("gamingCenterId", "status");

-- CreateIndex
CREATE INDEX "Page_gamingCenterId_type_idx" ON "Page"("gamingCenterId", "type");

-- CreateIndex
CREATE INDEX "Page_gamingCenterId_publishedAt_idx" ON "Page"("gamingCenterId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Page_gamingCenterId_slug_key" ON "Page"("gamingCenterId", "slug");

-- CreateIndex
CREATE INDEX "PageSection_pageId_sortOrder_idx" ON "PageSection"("pageId", "sortOrder");

-- CreateIndex
CREATE INDEX "PageSection_pageId_isEnabled_idx" ON "PageSection"("pageId", "isEnabled");

-- CreateIndex
CREATE INDEX "PageSection_pageId_type_idx" ON "PageSection"("pageId", "type");

-- CreateIndex
CREATE INDEX "Media_gamingCenterId_purpose_isActive_sortOrder_idx" ON "Media"("gamingCenterId", "purpose", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Media_gamingCenterId_category_idx" ON "Media"("gamingCenterId", "category");

-- CreateIndex
CREATE INDEX "SocialLink_gamingCenterId_type_idx" ON "SocialLink"("gamingCenterId", "type");

-- CreateIndex
CREATE INDEX "SocialLink_gamingCenterId_isPrimary_idx" ON "SocialLink"("gamingCenterId", "isPrimary");

-- CreateIndex
CREATE INDEX "SocialLink_gamingCenterId_isActive_idx" ON "SocialLink"("gamingCenterId", "isActive");

-- CreateIndex
CREATE INDEX "Address_gamingCenterId_idx" ON "Address"("gamingCenterId");

-- CreateIndex
CREATE INDEX "Address_gamingCenterId_isPrimary_idx" ON "Address"("gamingCenterId", "isPrimary");

-- CreateIndex
CREATE INDEX "Address_province_idx" ON "Address"("province");

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "Address"("city");

-- CreateIndex
CREATE INDEX "PageSlugHistory_pageId_createdAt_idx" ON "PageSlugHistory"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "PageSlugHistory_oldSlug_idx" ON "PageSlugHistory"("oldSlug");

-- CreateIndex
CREATE INDEX "WalletTransaction_customerAccountId_idx" ON "WalletTransaction"("customerAccountId");

-- CreateIndex
CREATE INDEX "WalletTransaction_reservationId_idx" ON "WalletTransaction"("reservationId");

-- CreateIndex
CREATE INDEX "AuditLog_gamingCenterId_createdAt_idx" ON "AuditLog"("gamingCenterId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStation" ADD CONSTRAINT "GameStation_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffStationSkill" ADD CONSTRAINT "StaffStationSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffStationSkill" ADD CONSTRAINT "StaffStationSkill_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "CommissionPolicy_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Earning" ADD CONSTRAINT "Earning_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Earning" ADD CONSTRAINT "Earning_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningPayment" ADD CONSTRAINT "EarningPayment_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "Earning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSection" ADD CONSTRAINT "PageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSlugHistory" ADD CONSTRAINT "PageSlugHistory_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingSession" ADD CONSTRAINT "GamingSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingSession" ADD CONSTRAINT "GamingSession_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationMaintenance" ADD CONSTRAINT "StationMaintenance_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
