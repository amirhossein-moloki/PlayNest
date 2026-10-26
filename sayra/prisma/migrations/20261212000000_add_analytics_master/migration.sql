-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'SUPERVISOR', 'STAFF', 'TRAINEE', 'SUPPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ShiftRole" AS ENUM ('CASHIER', 'TECH_SUPPORT', 'CLEANER', 'HOST', 'SECURITY');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReservationProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('ONLINE', 'WALK_IN', 'PHONE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE', 'GIFT_CARD', 'MEMBERSHIP');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'VOID', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReservationPaymentState" AS ENUM ('UNPAID', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'OVERPAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('HOME', 'ABOUT', 'SERVICES', 'GALLERY', 'TEAM', 'CONTACT', 'CUSTOM', 'TOURNAMENT', 'BLOG', 'LANDING', 'LEGAL');

-- CreateEnum
CREATE TYPE "PageSectionType" AS ENUM ('HERO', 'RICH_TEXT', 'HIGHLIGHTS', 'SERVICES_GRID', 'STAFF_GRID', 'GALLERY_GRID', 'TESTIMONIALS', 'CONTACT_CARD', 'MAP', 'FAQ', 'CTA');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'FILE');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('COVER', 'GALLERY', 'STATION', 'LOGO', 'AVATAR', 'POST_ATTACHMENT');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'WEBSITE', 'PHONE', 'GOOGLE_MAP');

-- CreateEnum
CREATE TYPE "RatingStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "RobotsIndex" AS ENUM ('INDEX', 'NOINDEX');

-- CreateEnum
CREATE TYPE "RobotsFollow" AS ENUM ('FOLLOW', 'NOFOLLOW');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "SeriesOrderStrategy" AS ENUM ('MANUAL', 'BY_DATE');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'ANGRY');

-- CreateEnum
CREATE TYPE "MenuLocation" AS ENUM ('HEADER', 'FOOTER', 'SIDEBAR');

-- CreateEnum
CREATE TYPE "MenuItemTargetType" AS ENUM ('PAGE', 'POST', 'CATEGORY', 'TAG', 'URL');

-- CreateEnum
CREATE TYPE "NavigationVisibilityRule" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'STAFF', 'ADMIN');

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
CREATE TYPE "NotificationType" AS ENUM ('RESERVATION_CREATED', 'RESERVATION_CONFIRMED', 'RESERVATION_REJECTED', 'RESERVATION_CANCELLED', 'RESERVATION_TIME_PROPOSED', 'RESERVATION_REMINDER', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'WAITLIST_OFFER_CREATED', 'WAITLIST_OFFER_EXPIRED', 'WAITLIST_ENTRY_CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationDispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'OFFERED', 'CONVERTED', 'CANCELLED', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WaitlistOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountTargetType" AS ENUM ('GAMING_CENTER', 'STATION');

-- CreateEnum
CREATE TYPE "DiscountValueType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "DiscountFundingSource" AS ENUM ('PLATFORM', 'CAMPAIGN_BUDGET', 'MERCHANT_FUNDED');

-- CreateEnum
CREATE TYPE "DiscountCodeType" AS ENUM ('PROMO_CODE', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PAYMENT_COLLECTION', 'REFUND_DISBURSEMENT', 'COMPENSATING_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED', 'DISCREPANCY_AMOUNT', 'DISCREPANCY_STATUS', 'MISSING_PROVIDER_REF', 'UNCONFIRMED_PROVIDER_STATE');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'ELECTRICITY_ENERGY', 'INTERNET_COMMUNICATION', 'SALARIES_WAGES', 'MAINTENANCE_REPAIR', 'PARTS_EQUIPMENT', 'MARKETING', 'ADMINISTRATIVE', 'OTHER_SERVICES', 'OTHER_DOCUMENTED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'VOID');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('REPORTED', 'IN_MAINTENANCE', 'REPAIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CancellationCategory" AS ENUM ('CUSTOMER_CANCEL', 'CENTER_CANCEL', 'PAYMENT_FAILED', 'CAPACITY_UNAVAILABLE', 'TECHNICAL_ISSUE', 'SCHEDULE_CONFLICT', 'OPERATIONAL_ISSUE', 'EMERGENCY', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CancellationActor" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

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
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "username" TEXT,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "isSuperuser" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorProfile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorProfile_pkey" PRIMARY KEY ("userId")
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
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "purpose" "MediaPurpose" NOT NULL DEFAULT 'GALLERY',
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "storageKey" TEXT,
    "mime" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    "title" TEXT,
    "category" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMedia" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "attachmentType" TEXT NOT NULL DEFAULT 'in-content',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderStrategy" "SeriesOrderStrategy" NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "readingTimeSec" INTEGER NOT NULL DEFAULT 0,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT,
    "seriesId" TEXT,
    "coverMediaId" TEXT,
    "ogImageId" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "editorId" TEXT,
    "content" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "changeNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "rootId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PENDING',
    "ip" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "contentType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionAggregate" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReactionAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" "MenuLocation" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "parentId" TEXT,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "targetBlank" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetType" "MenuItemTargetType" NOT NULL DEFAULT 'URL',
    "targetId" TEXT,
    "visibility" "NavigationVisibilityRule" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
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
    "fullPath" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PageType" NOT NULL DEFAULT 'CUSTOM',
    "parentId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(6),
    "scheduledAt" TIMESTAMPTZ(6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "content" TEXT,
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
CREATE TABLE "PageSlugHistory" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageMedia" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "attachmentType" TEXT NOT NULL DEFAULT 'in-content',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageMedia_pkey" PRIMARY KEY ("id")
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
    "minAdvanceBookingMinutes" INTEGER NOT NULL DEFAULT 30,
    "cancellationHours" INTEGER NOT NULL DEFAULT 2,
    "noShowPenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoReleaseUnpaidMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
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
    "originalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerPayableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFundedDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "merchantPayoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountFundingSource" "DiscountFundingSource",
    "voucherCode" TEXT,
    "discountId" TEXT,
    "campaignId" TEXT,
    "paymentState" "ReservationPaymentState" NOT NULL DEFAULT 'UNPAID',
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "ReservationSource" NOT NULL DEFAULT 'WALK_IN',
    "note" TEXT,
    "canceledAt" TIMESTAMPTZ(6),
    "cancelReason" TEXT,
    "cancelCategory" "CancellationCategory",
    "cancelActor" "CancellationActor",
    "canceledByUserId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "noShowAt" TIMESTAMPTZ(6),
    "groupBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBooking" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentState" "ReservationPaymentState" NOT NULL DEFAULT 'UNPAID',
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "note" TEXT,
    "canceledAt" TIMESTAMPTZ(6),
    "cancelReason" TEXT,
    "canceledByUserId" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBookingItem" (
    "id" TEXT NOT NULL,
    "groupBookingId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "staffId" TEXT,
    "reservationId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupBookingItem_pkey" PRIMARY KEY ("id")
);

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
    "gamingCenterId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "breakdownType" TEXT,
    "severity" "MaintenanceSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'REPORTED',
    "reportedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repairedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "eventType" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pagePath" TEXT,
    "stationId" TEXT,
    "reservationId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "deduplicationKey" TEXT,
    "payload" JSONB,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingCenterExpense" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "expenseDate" TIMESTAMPTZ(6) NOT NULL,
    "description" TEXT,
    "referenceNumber" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'APPROVED',
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GamingCenterExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaignSpend" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "startDate" TIMESTAMPTZ(6) NOT NULL,
    "endDate" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MarketingCampaignSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueForecastRun" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "forecastHorizonDays" INTEGER NOT NULL,
    "evaluationMetrics" JSONB,
    "sufficiencyStatus" TEXT NOT NULL,
    "forecastData" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueForecastRun_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "reservationId" TEXT,
    "groupBookingId" TEXT,
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
CREATE TABLE "CommissionPolicy" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "type" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "percentBps" INTEGER,
    "fixedAmount" INTEGER,
    "currency" TEXT,
    "monthlyTarget" INTEGER,
    "maxPercentBps" INTEGER NOT NULL DEFAULT 10000,
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
    "targetPeriod" TEXT,
    "targetReached" BOOLEAN NOT NULL DEFAULT false,
    "targetContribution" BOOLEAN NOT NULL DEFAULT false,
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
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "targetType" "DiscountTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "valueType" "DiscountValueType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "startAt" TIMESTAMPTZ(6) NOT NULL,
    "endAt" TIMESTAMPTZ(6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCampaign" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "codeType" "DiscountCodeType" NOT NULL DEFAULT 'PROMO_CODE',
    "description" TEXT,
    "targetType" "DiscountTargetType" NOT NULL DEFAULT 'GAMING_CENTER',
    "targetId" TEXT,
    "valueType" "DiscountValueType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" DOUBLE PRECISION NOT NULL,
    "maxDiscountAmount" DOUBLE PRECISION,
    "minReservationAmount" DOUBLE PRECISION,
    "fundingSource" "DiscountFundingSource" NOT NULL DEFAULT 'PLATFORM',
    "totalBudget" DOUBLE PRECISION,
    "usedBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxUsageCount" INTEGER,
    "currentUsageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsagePerUser" INTEGER NOT NULL DEFAULT 1,
    "startAt" TIMESTAMPTZ(6) NOT NULL,
    "endAt" TIMESTAMPTZ(6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountUsage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "fundingSource" "DiscountFundingSource" NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountUsage_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "userId" TEXT,
    "recipient" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'SMS',
    "type" "NotificationType" NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "templateId" INTEGER,
    "parameters" JSONB,
    "metadata" JSONB,
    "status" "NotificationDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMPTZ(6),
    "lastError" TEXT,
    "providerRefId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "failureReason" TEXT,
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT,
    "rawPayload" JSONB,
    "requestedById" TEXT,
    "processedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT,
    "refundId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "details" JSONB,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "convertedReservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistOffer" (
    "id" TEXT NOT NULL,
    "waitlistEntryId" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "offeredStartTime" TIMESTAMPTZ(6) NOT NULL,
    "offeredEndTime" TIMESTAMPTZ(6) NOT NULL,
    "status" "WaitlistOfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistOffer_pkey" PRIMARY KEY ("id")
);

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
    "originalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerPayableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFundedDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "merchantPayoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountFundingSource" "DiscountFundingSource",
    "campaignId" TEXT,
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
CREATE UNIQUE INDEX "GamingCenter_slug_key" ON "GamingCenter"("slug");

-- CreateIndex
CREATE INDEX "GamingCenter_slug_idx" ON "GamingCenter"("slug");

-- CreateIndex
CREATE INDEX "User_gamingCenterId_role_idx" ON "User"("gamingCenterId", "role");

-- CreateIndex
CREATE INDEX "User_gamingCenterId_isActive_idx" ON "User"("gamingCenterId", "isActive");

-- CreateIndex
CREATE INDEX "User_gamingCenterId_isPublic_idx" ON "User"("gamingCenterId", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "User_gamingCenterId_phone_key" ON "User"("gamingCenterId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_gamingCenterId_username_key" ON "User"("gamingCenterId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "User_gamingCenterId_email_key" ON "User"("gamingCenterId", "email");

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
CREATE INDEX "Media_gamingCenterId_purpose_isActive_sortOrder_idx" ON "Media"("gamingCenterId", "purpose", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Media_gamingCenterId_category_idx" ON "Media"("gamingCenterId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PostMedia_postId_mediaId_attachmentType_key" ON "PostMedia"("postId", "mediaId", "attachmentType");

-- CreateIndex
CREATE INDEX "Category_gamingCenterId_slug_idx" ON "Category"("gamingCenterId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_gamingCenterId_slug_key" ON "Category"("gamingCenterId", "slug");

-- CreateIndex
CREATE INDEX "Tag_gamingCenterId_slug_idx" ON "Tag"("gamingCenterId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_gamingCenterId_slug_key" ON "Tag"("gamingCenterId", "slug");

-- CreateIndex
CREATE INDEX "Series_gamingCenterId_slug_idx" ON "Series"("gamingCenterId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Series_gamingCenterId_slug_key" ON "Series"("gamingCenterId", "slug");

-- CreateIndex
CREATE INDEX "Post_gamingCenterId_status_idx" ON "Post"("gamingCenterId", "status");

-- CreateIndex
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_gamingCenterId_slug_key" ON "Post"("gamingCenterId", "slug");

-- CreateIndex
CREATE INDEX "Comment_gamingCenterId_postId_status_isActive_idx" ON "Comment"("gamingCenterId", "postId", "status", "isActive");

-- CreateIndex
CREATE INDEX "Comment_rootId_status_isActive_idx" ON "Comment"("rootId", "status", "isActive");

-- CreateIndex
CREATE INDEX "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Reaction_contentType_objectId_idx" ON "Reaction"("contentType", "objectId");

-- CreateIndex
CREATE INDEX "Reaction_gamingCenterId_idx" ON "Reaction"("gamingCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_contentType_objectId_key" ON "Reaction"("userId", "contentType", "objectId");

-- CreateIndex
CREATE INDEX "ReactionAggregate_gamingCenterId_idx" ON "ReactionAggregate"("gamingCenterId");

-- CreateIndex
CREATE INDEX "ReactionAggregate_contentType_objectId_idx" ON "ReactionAggregate"("contentType", "objectId");

-- CreateIndex
CREATE UNIQUE INDEX "ReactionAggregate_contentType_objectId_type_key" ON "ReactionAggregate"("contentType", "objectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_gamingCenterId_location_key" ON "Menu"("gamingCenterId", "location");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSettings_gamingCenterId_key" ON "SiteSettings"("gamingCenterId");

-- CreateIndex
CREATE INDEX "Page_gamingCenterId_status_idx" ON "Page"("gamingCenterId", "status");

-- CreateIndex
CREATE INDEX "Page_gamingCenterId_type_idx" ON "Page"("gamingCenterId", "type");

-- CreateIndex
CREATE INDEX "Page_gamingCenterId_publishedAt_idx" ON "Page"("gamingCenterId", "publishedAt");

-- CreateIndex
CREATE INDEX "Page_fullPath_idx" ON "Page"("fullPath");

-- CreateIndex
CREATE UNIQUE INDEX "Page_gamingCenterId_slug_key" ON "Page"("gamingCenterId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Page_gamingCenterId_fullPath_key" ON "Page"("gamingCenterId", "fullPath");

-- CreateIndex
CREATE INDEX "PageSection_pageId_sortOrder_idx" ON "PageSection"("pageId", "sortOrder");

-- CreateIndex
CREATE INDEX "PageSection_pageId_isEnabled_idx" ON "PageSection"("pageId", "isEnabled");

-- CreateIndex
CREATE INDEX "PageSection_pageId_type_idx" ON "PageSection"("pageId", "type");

-- CreateIndex
CREATE INDEX "PageSlugHistory_pageId_createdAt_idx" ON "PageSlugHistory"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "PageSlugHistory_oldSlug_idx" ON "PageSlugHistory"("oldSlug");

-- CreateIndex
CREATE UNIQUE INDEX "PageMedia_pageId_mediaId_attachmentType_key" ON "PageMedia"("pageId", "mediaId", "attachmentType");

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
CREATE UNIQUE INDEX "Settings_gamingCenterId_key" ON "Settings"("gamingCenterId");

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
CREATE INDEX "Reservation_groupBookingId_idx" ON "Reservation"("groupBookingId");

-- CreateIndex
CREATE INDEX "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "GroupBooking_gamingCenterId_startTime_idx" ON "GroupBooking"("gamingCenterId", "startTime");

-- CreateIndex
CREATE INDEX "GroupBooking_customerAccountId_startTime_idx" ON "GroupBooking"("customerAccountId", "startTime");

-- CreateIndex
CREATE INDEX "GroupBooking_customerProfileId_startTime_idx" ON "GroupBooking"("customerProfileId", "startTime");

-- CreateIndex
CREATE INDEX "GroupBooking_gamingCenterId_status_startTime_idx" ON "GroupBooking"("gamingCenterId", "status", "startTime");

-- CreateIndex
CREATE INDEX "GroupBooking_status_expiresAt_idx" ON "GroupBooking"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBookingItem_reservationId_key" ON "GroupBookingItem"("reservationId");

-- CreateIndex
CREATE INDEX "GroupBookingItem_groupBookingId_idx" ON "GroupBookingItem"("groupBookingId");

-- CreateIndex
CREATE INDEX "GroupBookingItem_stationId_idx" ON "GroupBookingItem"("stationId");

-- CreateIndex
CREATE INDEX "ReservationTimeProposal_reservationId_status_idx" ON "ReservationTimeProposal"("reservationId", "status");

-- CreateIndex
CREATE INDEX "ReservationTimeProposal_reservationId_createdAt_idx" ON "ReservationTimeProposal"("reservationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReservationHistory_reservationId_createdAt_idx" ON "ReservationHistory"("reservationId", "createdAt");

-- CreateIndex
CREATE INDEX "StationMaintenance_stationId_startTime_idx" ON "StationMaintenance"("stationId", "startTime");

-- CreateIndex
CREATE INDEX "StationMaintenance_gamingCenterId_status_idx" ON "StationMaintenance"("gamingCenterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_deduplicationKey_key" ON "AnalyticsEvent"("deduplicationKey");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_gamingCenterId_eventType_timestamp_idx" ON "AnalyticsEvent"("gamingCenterId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_visitorId_timestamp_idx" ON "AnalyticsEvent"("visitorId", "timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");

-- CreateIndex
CREATE INDEX "GamingCenterExpense_gamingCenterId_status_expenseDate_idx" ON "GamingCenterExpense"("gamingCenterId", "status", "expenseDate");

-- CreateIndex
CREATE INDEX "GamingCenterExpense_gamingCenterId_category_idx" ON "GamingCenterExpense"("gamingCenterId", "category");

-- CreateIndex
CREATE INDEX "MarketingCampaignSpend_gamingCenterId_startDate_endDate_idx" ON "MarketingCampaignSpend"("gamingCenterId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "MarketingCampaignSpend_campaignId_idx" ON "MarketingCampaignSpend"("campaignId");

-- CreateIndex
CREATE INDEX "RevenueForecastRun_gamingCenterId_createdAt_idx" ON "RevenueForecastRun"("gamingCenterId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_reservationId_paidAt_idx" ON "Payment"("reservationId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_groupBookingId_paidAt_idx" ON "Payment"("groupBookingId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_gamingCenterId_status_paidAt_idx" ON "Payment"("gamingCenterId", "status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gamingCenterId_idempotencyKey_key" ON "Payment"("gamingCenterId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_customerAccountId_idx" ON "WalletTransaction"("customerAccountId");

-- CreateIndex
CREATE INDEX "WalletTransaction_reservationId_idx" ON "WalletTransaction"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_reservationId_type_key" ON "WalletTransaction"("reservationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPolicy_gamingCenterId_key" ON "CommissionPolicy"("gamingCenterId");

-- CreateIndex
CREATE INDEX "CommissionPolicy_gamingCenterId_isActive_idx" ON "CommissionPolicy"("gamingCenterId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Earning_reservationId_key" ON "Earning"("reservationId");

-- CreateIndex
CREATE INDEX "Earning_gamingCenterId_status_createdAt_idx" ON "Earning"("gamingCenterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Earning_gamingCenterId_targetPeriod_idx" ON "Earning"("gamingCenterId", "targetPeriod");

-- CreateIndex
CREATE INDEX "Earning_chargedAt_idx" ON "Earning"("chargedAt");

-- CreateIndex
CREATE INDEX "EarningPayment_earningId_paidAt_idx" ON "EarningPayment"("earningId", "paidAt");

-- CreateIndex
CREATE INDEX "EarningPayment_status_paidAt_idx" ON "EarningPayment"("status", "paidAt");

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
CREATE INDEX "AuditLog_gamingCenterId_createdAt_idx" ON "AuditLog"("gamingCenterId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

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
CREATE INDEX "Discount_gamingCenterId_isActive_startAt_endAt_idx" ON "Discount"("gamingCenterId", "isActive", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Discount_gamingCenterId_targetType_targetId_idx" ON "Discount"("gamingCenterId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCampaign_code_key" ON "DiscountCampaign"("code");

-- CreateIndex
CREATE INDEX "DiscountCampaign_gamingCenterId_isActive_startAt_endAt_idx" ON "DiscountCampaign"("gamingCenterId", "isActive", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "DiscountCampaign_code_idx" ON "DiscountCampaign"("code");

-- CreateIndex
CREATE INDEX "DiscountUsage_campaignId_customerAccountId_idx" ON "DiscountUsage"("campaignId", "customerAccountId");

-- CreateIndex
CREATE INDEX "DiscountUsage_reservationId_idx" ON "DiscountUsage"("reservationId");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_idempotencyKey_key" ON "NotificationLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationLog_status_scheduledAt_idx" ON "NotificationLog"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationLog_status_nextRetryAt_idx" ON "NotificationLog"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "NotificationLog_entityType_entityId_idx" ON "NotificationLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "NotificationLog_idempotencyKey_idx" ON "NotificationLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationLog_gamingCenterId_createdAt_idx" ON "NotificationLog"("gamingCenterId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_paymentId_status_idx" ON "Refund"("paymentId", "status");

-- CreateIndex
CREATE INDEX "Refund_gamingCenterId_status_createdAt_idx" ON "Refund"("gamingCenterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_gamingCenterId_idempotencyKey_key" ON "Refund"("gamingCenterId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_gamingCenterId_createdAt_idx" ON "LedgerEntry"("gamingCenterId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_refundId_idx" ON "LedgerEntry"("refundId");

-- CreateIndex
CREATE INDEX "LedgerEntry_entryType_idx" ON "LedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_gamingCenterId_status_reconciledAt_idx" ON "ReconciliationRecord"("gamingCenterId", "status", "reconciledAt");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_paymentId_idx" ON "ReconciliationRecord"("paymentId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_gamingCenterId_stationId_status_startTime_end_idx" ON "WaitlistEntry"("gamingCenterId", "stationId", "status", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "WaitlistEntry_customerAccountId_status_idx" ON "WaitlistEntry"("customerAccountId", "status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_createdAt_idx" ON "WaitlistEntry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WaitlistOffer_waitlistEntryId_status_idx" ON "WaitlistOffer"("waitlistEntryId", "status");

-- CreateIndex
CREATE INDEX "WaitlistOffer_gamingCenterId_status_expiresAt_idx" ON "WaitlistOffer"("gamingCenterId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "WaitlistOffer_status_expiresAt_idx" ON "WaitlistOffer"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AnalyticsIngestionRun_entity_startedAt_idx" ON "AnalyticsIngestionRun"("entity", "startedAt");

-- CreateIndex
CREATE INDEX "AnalyticsIngestionRun_status_startedAt_idx" ON "AnalyticsIngestionRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "AnalyticsTenant_slug_idx" ON "AnalyticsTenant"("slug");

-- CreateIndex
CREATE INDEX "AnalyticsTenant_isActive_idx" ON "AnalyticsTenant"("isActive");

-- CreateIndex
CREATE INDEX "AnalyticsCustomer_phone_idx" ON "AnalyticsCustomer"("phone");

-- CreateIndex
CREATE INDEX "AnalyticsCustomer_gamingCenterId_idx" ON "AnalyticsCustomer"("gamingCenterId");

-- CreateIndex
CREATE INDEX "AnalyticsStation_gamingCenterId_isActive_idx" ON "AnalyticsStation"("gamingCenterId", "isActive");

-- CreateIndex
CREATE INDEX "AnalyticsReservation_gamingCenterId_startTime_idx" ON "AnalyticsReservation"("gamingCenterId", "startTime");

-- CreateIndex
CREATE INDEX "AnalyticsReservation_gamingCenterId_status_startTime_idx" ON "AnalyticsReservation"("gamingCenterId", "status", "startTime");

-- CreateIndex
CREATE INDEX "AnalyticsReservation_customerAccountId_startTime_idx" ON "AnalyticsReservation"("customerAccountId", "startTime");

-- CreateIndex
CREATE INDEX "AnalyticsGamingSession_reservationId_idx" ON "AnalyticsGamingSession"("reservationId");

-- CreateIndex
CREATE INDEX "AnalyticsGamingSession_stationId_startTime_idx" ON "AnalyticsGamingSession"("stationId", "startTime");

-- CreateIndex
CREATE INDEX "AnalyticsGamingSession_gamingCenterId_idx" ON "AnalyticsGamingSession"("gamingCenterId");

-- CreateIndex
CREATE INDEX "AnalyticsPayment_gamingCenterId_status_paidAt_idx" ON "AnalyticsPayment"("gamingCenterId", "status", "paidAt");

-- CreateIndex
CREATE INDEX "AnalyticsPayment_reservationId_idx" ON "AnalyticsPayment"("reservationId");

-- CreateIndex
CREATE INDEX "AnalyticsLedgerEntry_gamingCenterId_sourceCreatedAt_idx" ON "AnalyticsLedgerEntry"("gamingCenterId", "sourceCreatedAt");

-- CreateIndex
CREATE INDEX "AnalyticsLedgerEntry_paymentId_idx" ON "AnalyticsLedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "AnalyticsLedgerEntry_entryType_idx" ON "AnalyticsLedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "AnalyticsRefund_gamingCenterId_status_sourceCreatedAt_idx" ON "AnalyticsRefund"("gamingCenterId", "status", "sourceCreatedAt");

-- CreateIndex
CREATE INDEX "AnalyticsRefund_paymentId_idx" ON "AnalyticsRefund"("paymentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorProfile" ADD CONSTRAINT "AuthorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorProfile" ADD CONSTRAINT "AuthorProfile_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AuthorProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactionAggregate" ADD CONSTRAINT "ReactionAggregate_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSection" ADD CONSTRAINT "PageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSlugHistory" ADD CONSTRAINT "PageSlugHistory_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageMedia" ADD CONSTRAINT "PageMedia_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageMedia" ADD CONSTRAINT "PageMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscountCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTimeProposal" ADD CONSTRAINT "ReservationTimeProposal_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTimeProposal" ADD CONSTRAINT "ReservationTimeProposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingSession" ADD CONSTRAINT "GamingSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingSession" ADD CONSTRAINT "GamingSession_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationMaintenance" ADD CONSTRAINT "StationMaintenance_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingCenterExpense" ADD CONSTRAINT "GamingCenterExpense_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignSpend" ADD CONSTRAINT "MarketingCampaignSpend_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueForecastRun" ADD CONSTRAINT "RevenueForecastRun_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "CommissionPolicy_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Earning" ADD CONSTRAINT "Earning_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Earning" ADD CONSTRAINT "Earning_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningPayment" ADD CONSTRAINT "EarningPayment_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "Earning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCampaign" ADD CONSTRAINT "DiscountCampaign_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCampaign" ADD CONSTRAINT "DiscountCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscountCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
