-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'SUPERVISOR', 'STAFF', 'TRAINEE', 'SUPPORT', 'ADMIN'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftRole') THEN CREATE TYPE "ShiftRole" AS ENUM ('CASHIER', 'TECH_SUPPORT', 'CLEANER', 'HOST', 'SECURITY'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationStatus') THEN CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'EXPIRED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationProposalStatus') THEN CREATE TYPE "ReservationProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationSource') THEN CREATE TYPE "ReservationSource" AS ENUM ('ONLINE', 'WALK_IN', 'PHONE'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE', 'GIFT_CARD', 'MEMBERSHIP'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'VOID', 'CANCELED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationPaymentState') THEN CREATE TYPE "ReservationPaymentState" AS ENUM ('UNPAID', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'OVERPAID', 'FAILED', 'CANCELED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PageStatus') THEN CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PageType') THEN CREATE TYPE "PageType" AS ENUM ('HOME', 'ABOUT', 'SERVICES', 'GALLERY', 'TEAM', 'CONTACT', 'CUSTOM', 'TOURNAMENT', 'BLOG', 'LANDING', 'LEGAL'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PageSectionType') THEN CREATE TYPE "PageSectionType" AS ENUM ('HERO', 'RICH_TEXT', 'HIGHLIGHTS', 'SERVICES_GRID', 'STAFF_GRID', 'GALLERY_GRID', 'TESTIMONIALS', 'CONTACT_CARD', 'MAP', 'FAQ', 'CTA'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaType') THEN CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'FILE'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaPurpose') THEN CREATE TYPE "MediaPurpose" AS ENUM ('COVER', 'GALLERY', 'STATION', 'LOGO', 'AVATAR', 'POST_ATTACHMENT'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LinkType') THEN CREATE TYPE "LinkType" AS ENUM ('INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'WEBSITE', 'PHONE', 'GOOGLE_MAP'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RatingStatus') THEN CREATE TYPE "RatingStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RobotsIndex') THEN CREATE TYPE "RobotsIndex" AS ENUM ('INDEX', 'NOINDEX'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RobotsFollow') THEN CREATE TYPE "RobotsFollow" AS ENUM ('FOLLOW', 'NOFOLLOW'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostVisibility') THEN CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SeriesOrderStrategy') THEN CREATE TYPE "SeriesOrderStrategy" AS ENUM ('MANUAL', 'BY_DATE'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommentStatus') THEN CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELETED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReactionType') THEN CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'ANGRY'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MenuLocation') THEN CREATE TYPE "MenuLocation" AS ENUM ('HEADER', 'FOOTER', 'SIDEBAR'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MenuItemTargetType') THEN CREATE TYPE "MenuItemTargetType" AS ENUM ('PAGE', 'POST', 'CATEGORY', 'TAG', 'URL'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NavigationVisibilityRule') THEN CREATE TYPE "NavigationVisibilityRule" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'STAFF', 'ADMIN'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommissionType') THEN CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FIXED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommissionStatus') THEN CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'ACCRUED', 'CHARGED', 'WAIVED', 'REFUNDED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommissionPaymentMethod') THEN CREATE TYPE "CommissionPaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE', 'TRANSFER'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommissionPaymentStatus') THEN CREATE TYPE "CommissionPaymentStatus" AS ENUM ('PENDING', 'PAID', 'VOID', 'REFUNDED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionActorType') THEN CREATE TYPE "SessionActorType" AS ENUM ('USER', 'CUSTOMER'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OtpPurpose') THEN CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'SIGNUP'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OtpChannel') THEN CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'WHATSAPP'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GameStationType') THEN CREATE TYPE "GameStationType" AS ENUM ('PC', 'PLAYSTATION', 'XBOX', 'SWITCH', 'VR'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GamingSessionStatus') THEN CREATE TYPE "GamingSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'INTERRUPTED', 'NO_SHOW'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkillLevel') THEN CREATE TYPE "SkillLevel" AS ENUM ('BASIC', 'INTERMEDIATE', 'EXPERT'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionType') THEN CREATE TYPE "WalletTransactionType" AS ENUM ('REFUND', 'RESERVATION_PAYMENT', 'DEPOSIT', 'MANUAL_ADJUSTMENT'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketStatus') THEN CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'ANSWERED', 'CLOSED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketPriority') THEN CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketCategory') THEN CREATE TYPE "TicketCategory" AS ENUM ('TECHNICAL', 'FINANCIAL', 'SALES', 'ACCOUNT'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketSenderType') THEN CREATE TYPE "TicketSenderType" AS ENUM ('USER', 'SUPPORT'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN CREATE TYPE "NotificationType" AS ENUM ('RESERVATION_CREATED', 'RESERVATION_CONFIRMED', 'RESERVATION_REJECTED', 'RESERVATION_CANCELLED', 'RESERVATION_TIME_PROPOSED', 'RESERVATION_REMINDER', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'WAITLIST_OFFER_CREATED', 'WAITLIST_OFFER_EXPIRED', 'WAITLIST_ENTRY_CANCELLED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel') THEN CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SMS', 'EMAIL'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationDispatchStatus') THEN CREATE TYPE "NotificationDispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WaitlistStatus') THEN CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'OFFERED', 'CONVERTED', 'CANCELLED', 'EXPIRED', 'CLOSED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WaitlistOfferStatus') THEN CREATE TYPE "WaitlistOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountTargetType') THEN CREATE TYPE "DiscountTargetType" AS ENUM ('GAMING_CENTER', 'STATION'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountValueType') THEN CREATE TYPE "DiscountValueType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountFundingSource') THEN CREATE TYPE "DiscountFundingSource" AS ENUM ('PLATFORM', 'CAMPAIGN_BUDGET', 'MERCHANT_FUNDED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountCodeType') THEN CREATE TYPE "DiscountCodeType" AS ENUM ('PROMO_CODE', 'AUTOMATIC'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RefundStatus') THEN CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'AMBIGUOUS'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerEntryType') THEN CREATE TYPE "LedgerEntryType" AS ENUM ('PAYMENT_COLLECTION', 'REFUND_DISBURSEMENT', 'COMPENSATING_ADJUSTMENT'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReconciliationStatus') THEN CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED', 'DISCREPANCY_AMOUNT', 'DISCREPANCY_STATUS', 'MISSING_PROVIDER_REF', 'UNCONFIRMED_PROVIDER_STATE'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseCategory') THEN CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'ELECTRICITY_ENERGY', 'INTERNET_COMMUNICATION', 'SALARIES_WAGES', 'MAINTENANCE_REPAIR', 'PARTS_EQUIPMENT', 'MARKETING', 'ADMINISTRATIVE', 'OTHER_SERVICES', 'OTHER_DOCUMENTED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseStatus') THEN CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'VOID'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceStatus') THEN CREATE TYPE "MaintenanceStatus" AS ENUM ('REPORTED', 'IN_MAINTENANCE', 'REPAIRED', 'CANCELLED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceSeverity') THEN CREATE TYPE "MaintenanceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CancellationCategory') THEN CREATE TYPE "CancellationCategory" AS ENUM ('CUSTOMER_CANCEL', 'CENTER_CANCEL', 'PAYMENT_FAILED', 'CAPACITY_UNAVAILABLE', 'TECHNICAL_ISSUE', 'SCHEDULE_CONFLICT', 'OPERATIONAL_ISSUE', 'EMERGENCY', 'OTHER', 'UNKNOWN'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CancellationActor') THEN CREATE TYPE "CancellationActor" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProvider') THEN CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'STRIPE', 'ZARINPAL'); END IF; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "GamingCenter" (
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
CREATE TABLE IF NOT EXISTS "User" (
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
CREATE TABLE IF NOT EXISTS "AuthorProfile" (
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
CREATE TABLE IF NOT EXISTS "CustomerAccount" (
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
CREATE TABLE IF NOT EXISTS "CustomerProfile" (
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
CREATE TABLE IF NOT EXISTS "Session" (
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
CREATE TABLE IF NOT EXISTS "PhoneOtp" (
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
CREATE TABLE IF NOT EXISTS "Media" (
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
CREATE TABLE IF NOT EXISTS "PostMedia" (
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
CREATE TABLE IF NOT EXISTS "Category" (
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
CREATE TABLE IF NOT EXISTS "Tag" (
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
CREATE TABLE IF NOT EXISTS "Series" (
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
CREATE TABLE IF NOT EXISTS "Post" (
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
CREATE TABLE IF NOT EXISTS "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Revision" (
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
CREATE TABLE IF NOT EXISTS "Comment" (
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
CREATE TABLE IF NOT EXISTS "Reaction" (
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
CREATE TABLE IF NOT EXISTS "ReactionAggregate" (
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
CREATE TABLE IF NOT EXISTS "Menu" (
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
CREATE TABLE IF NOT EXISTS "MenuItem" (
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
CREATE TABLE IF NOT EXISTS "SiteSettings" (
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
CREATE TABLE IF NOT EXISTS "Page" (
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
CREATE TABLE IF NOT EXISTS "PageSection" (
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
CREATE TABLE IF NOT EXISTS "PageSlugHistory" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PageMedia" (
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
CREATE TABLE IF NOT EXISTS "SocialLink" (
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
CREATE TABLE IF NOT EXISTS "Address" (
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
CREATE TABLE IF NOT EXISTS "Settings" (
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
CREATE TABLE IF NOT EXISTS "GameStation" (
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
CREATE TABLE IF NOT EXISTS "StaffStationSkill" (
    "userId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL DEFAULT 'BASIC',

    CONSTRAINT "StaffStationSkill_pkey" PRIMARY KEY ("userId","stationId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffShift" (
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
CREATE TABLE IF NOT EXISTS "Reservation" (
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
CREATE TABLE IF NOT EXISTS "GroupBooking" (
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
CREATE TABLE IF NOT EXISTS "GroupBookingItem" (
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
CREATE TABLE IF NOT EXISTS "ReservationTimeProposal" (
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
CREATE TABLE IF NOT EXISTS "ReservationHistory" (
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
CREATE TABLE IF NOT EXISTS "GamingSession" (
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
CREATE TABLE IF NOT EXISTS "StationMaintenance" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
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
CREATE TABLE IF NOT EXISTS "GamingCenterExpense" (
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
CREATE TABLE IF NOT EXISTS "MarketingCampaignSpend" (
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
CREATE TABLE IF NOT EXISTS "RevenueForecastRun" (
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
CREATE TABLE IF NOT EXISTS "Tournament" (
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
CREATE TABLE IF NOT EXISTS "Payment" (
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
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
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
CREATE TABLE IF NOT EXISTS "Membership" (
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
CREATE TABLE IF NOT EXISTS "CommissionPolicy" (
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
CREATE TABLE IF NOT EXISTS "Earning" (
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
CREATE TABLE IF NOT EXISTS "EarningPayment" (
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
CREATE TABLE IF NOT EXISTS "Rating" (
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
CREATE TABLE IF NOT EXISTS "AuditLog" (
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
CREATE TABLE IF NOT EXISTS "GamingCenterAnalytics" (
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
CREATE TABLE IF NOT EXISTS "StaffAnalytics" (
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
CREATE TABLE IF NOT EXISTS "StationAnalytics" (
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
CREATE TABLE IF NOT EXISTS "Ticket" (
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
CREATE TABLE IF NOT EXISTS "Discount" (
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
CREATE TABLE IF NOT EXISTS "DiscountCampaign" (
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
CREATE TABLE IF NOT EXISTS "DiscountUsage" (
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
CREATE TABLE IF NOT EXISTS "TicketMessage" (
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
CREATE TABLE IF NOT EXISTS "Notification" (
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
CREATE TABLE IF NOT EXISTS "NotificationLog" (
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
CREATE TABLE IF NOT EXISTS "Refund" (
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
CREATE TABLE IF NOT EXISTS "LedgerEntry" (
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
CREATE TABLE IF NOT EXISTS "ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "details" JSONB,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
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
CREATE TABLE IF NOT EXISTS "WaitlistOffer" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsWatermark" (
    "entity" TEXT NOT NULL,
    "lastIngestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
    "lastSourceId" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AnalyticsWatermark_pkey" PRIMARY KEY ("entity")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnalyticsIngestionRun" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsTenant" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsCustomer" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsStation" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsReservation" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsGamingSession" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsPayment" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsLedgerEntry" (
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
CREATE TABLE IF NOT EXISTS "AnalyticsRefund" (
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
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GamingCenter') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "GamingCenter_slug_key" ON "GamingCenter"("slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GamingCenter') THEN
        CREATE  INDEX IF NOT EXISTS "GamingCenter_slug_idx" ON "GamingCenter"("slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        CREATE  INDEX IF NOT EXISTS "User_gamingCenterId_role_idx" ON "User"("gamingCenterId", "role");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        CREATE  INDEX IF NOT EXISTS "User_gamingCenterId_isActive_idx" ON "User"("gamingCenterId", "isActive");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        CREATE  INDEX IF NOT EXISTS "User_gamingCenterId_isPublic_idx" ON "User"("gamingCenterId", "isPublic");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "User_gamingCenterId_phone_key" ON "User"("gamingCenterId", "phone");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "User_gamingCenterId_username_key" ON "User"("gamingCenterId", "username");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "User_gamingCenterId_email_key" ON "User"("gamingCenterId", "email");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CustomerAccount') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "CustomerAccount_phone_key" ON "CustomerAccount"("phone");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CustomerAccount') THEN
        CREATE  INDEX IF NOT EXISTS "CustomerAccount_phone_idx" ON "CustomerAccount"("phone");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CustomerProfile') THEN
        CREATE  INDEX IF NOT EXISTS "CustomerProfile_gamingCenterId_displayName_idx" ON "CustomerProfile"("gamingCenterId", "displayName");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CustomerProfile') THEN
        CREATE  INDEX IF NOT EXISTS "CustomerProfile_customerAccountId_idx" ON "CustomerProfile"("customerAccountId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CustomerProfile') THEN
        CREATE  INDEX IF NOT EXISTS "CustomerProfile_gamingCenterId_createdAt_idx" ON "CustomerProfile"("gamingCenterId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CustomerProfile') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "CustomerProfile_gamingCenterId_customerAccountId_key" ON "CustomerProfile"("gamingCenterId", "customerAccountId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Session') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Session') THEN
        CREATE  INDEX IF NOT EXISTS "Session_actorType_actorId_expiresAt_idx" ON "Session"("actorType", "actorId", "expiresAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PhoneOtp') THEN
        CREATE  INDEX IF NOT EXISTS "PhoneOtp_phone_purpose_expiresAt_idx" ON "PhoneOtp"("phone", "purpose", "expiresAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PhoneOtp') THEN
        CREATE  INDEX IF NOT EXISTS "PhoneOtp_phone_createdAt_idx" ON "PhoneOtp"("phone", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PhoneOtp') THEN
        CREATE  INDEX IF NOT EXISTS "PhoneOtp_consumedAt_idx" ON "PhoneOtp"("consumedAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PhoneOtp') THEN
        CREATE  INDEX IF NOT EXISTS "PhoneOtp_targetActorType_targetActorId_idx" ON "PhoneOtp"("targetActorType", "targetActorId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Media') THEN
        CREATE  INDEX IF NOT EXISTS "Media_gamingCenterId_purpose_isActive_sortOrder_idx" ON "Media"("gamingCenterId", "purpose", "isActive", "sortOrder");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Media') THEN
        CREATE  INDEX IF NOT EXISTS "Media_gamingCenterId_category_idx" ON "Media"("gamingCenterId", "category");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PostMedia') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "PostMedia_postId_mediaId_attachmentType_key" ON "PostMedia"("postId", "mediaId", "attachmentType");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Category') THEN
        CREATE  INDEX IF NOT EXISTS "Category_gamingCenterId_slug_idx" ON "Category"("gamingCenterId", "slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Category') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Category_gamingCenterId_slug_key" ON "Category"("gamingCenterId", "slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Tag') THEN
        CREATE  INDEX IF NOT EXISTS "Tag_gamingCenterId_slug_idx" ON "Tag"("gamingCenterId", "slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Tag') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Tag_gamingCenterId_slug_key" ON "Tag"("gamingCenterId", "slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Series') THEN
        CREATE  INDEX IF NOT EXISTS "Series_gamingCenterId_slug_idx" ON "Series"("gamingCenterId", "slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Series') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Series_gamingCenterId_slug_key" ON "Series"("gamingCenterId", "slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Post') THEN
        CREATE  INDEX IF NOT EXISTS "Post_gamingCenterId_status_idx" ON "Post"("gamingCenterId", "status");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Post') THEN
        CREATE  INDEX IF NOT EXISTS "Post_authorId_idx" ON "Post"("authorId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Post') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Post_gamingCenterId_slug_key" ON "Post"("gamingCenterId", "slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Comment') THEN
        CREATE  INDEX IF NOT EXISTS "Comment_gamingCenterId_postId_status_isActive_idx" ON "Comment"("gamingCenterId", "postId", "status", "isActive");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Comment') THEN
        CREATE  INDEX IF NOT EXISTS "Comment_rootId_status_isActive_idx" ON "Comment"("rootId", "status", "isActive");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Comment') THEN
        CREATE  INDEX IF NOT EXISTS "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reaction') THEN
        CREATE  INDEX IF NOT EXISTS "Reaction_contentType_objectId_idx" ON "Reaction"("contentType", "objectId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reaction') THEN
        CREATE  INDEX IF NOT EXISTS "Reaction_gamingCenterId_idx" ON "Reaction"("gamingCenterId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reaction') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Reaction_userId_contentType_objectId_key" ON "Reaction"("userId", "contentType", "objectId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReactionAggregate') THEN
        CREATE  INDEX IF NOT EXISTS "ReactionAggregate_gamingCenterId_idx" ON "ReactionAggregate"("gamingCenterId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReactionAggregate') THEN
        CREATE  INDEX IF NOT EXISTS "ReactionAggregate_contentType_objectId_idx" ON "ReactionAggregate"("contentType", "objectId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReactionAggregate') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "ReactionAggregate_contentType_objectId_type_key" ON "ReactionAggregate"("contentType", "objectId", "type");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Menu') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Menu_gamingCenterId_location_key" ON "Menu"("gamingCenterId", "location");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SiteSettings') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "SiteSettings_gamingCenterId_key" ON "SiteSettings"("gamingCenterId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Page') THEN
        CREATE  INDEX IF NOT EXISTS "Page_gamingCenterId_status_idx" ON "Page"("gamingCenterId", "status");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Page') THEN
        CREATE  INDEX IF NOT EXISTS "Page_gamingCenterId_type_idx" ON "Page"("gamingCenterId", "type");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Page') THEN
        CREATE  INDEX IF NOT EXISTS "Page_gamingCenterId_publishedAt_idx" ON "Page"("gamingCenterId", "publishedAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Page') THEN
        CREATE  INDEX IF NOT EXISTS "Page_fullPath_idx" ON "Page"("fullPath");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Page') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Page_gamingCenterId_slug_key" ON "Page"("gamingCenterId", "slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Page') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Page_gamingCenterId_fullPath_key" ON "Page"("gamingCenterId", "fullPath");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PageSection') THEN
        CREATE  INDEX IF NOT EXISTS "PageSection_pageId_sortOrder_idx" ON "PageSection"("pageId", "sortOrder");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PageSection') THEN
        CREATE  INDEX IF NOT EXISTS "PageSection_pageId_isEnabled_idx" ON "PageSection"("pageId", "isEnabled");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PageSection') THEN
        CREATE  INDEX IF NOT EXISTS "PageSection_pageId_type_idx" ON "PageSection"("pageId", "type");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PageSlugHistory') THEN
        CREATE  INDEX IF NOT EXISTS "PageSlugHistory_pageId_createdAt_idx" ON "PageSlugHistory"("pageId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PageSlugHistory') THEN
        CREATE  INDEX IF NOT EXISTS "PageSlugHistory_oldSlug_idx" ON "PageSlugHistory"("oldSlug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PageMedia') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "PageMedia_pageId_mediaId_attachmentType_key" ON "PageMedia"("pageId", "mediaId", "attachmentType");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SocialLink') THEN
        CREATE  INDEX IF NOT EXISTS "SocialLink_gamingCenterId_type_idx" ON "SocialLink"("gamingCenterId", "type");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SocialLink') THEN
        CREATE  INDEX IF NOT EXISTS "SocialLink_gamingCenterId_isPrimary_idx" ON "SocialLink"("gamingCenterId", "isPrimary");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SocialLink') THEN
        CREATE  INDEX IF NOT EXISTS "SocialLink_gamingCenterId_isActive_idx" ON "SocialLink"("gamingCenterId", "isActive");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Address') THEN
        CREATE  INDEX IF NOT EXISTS "Address_gamingCenterId_idx" ON "Address"("gamingCenterId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Address') THEN
        CREATE  INDEX IF NOT EXISTS "Address_gamingCenterId_isPrimary_idx" ON "Address"("gamingCenterId", "isPrimary");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Address') THEN
        CREATE  INDEX IF NOT EXISTS "Address_province_idx" ON "Address"("province");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Address') THEN
        CREATE  INDEX IF NOT EXISTS "Address_city_idx" ON "Address"("city");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Settings') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Settings_gamingCenterId_key" ON "Settings"("gamingCenterId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GameStation') THEN
        CREATE  INDEX IF NOT EXISTS "GameStation_gamingCenterId_isActive_idx" ON "GameStation"("gamingCenterId", "isActive");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GameStation') THEN
        CREATE  INDEX IF NOT EXISTS "GameStation_gamingCenterId_name_idx" ON "GameStation"("gamingCenterId", "name");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'StaffStationSkill') THEN
        CREATE  INDEX IF NOT EXISTS "StaffStationSkill_stationId_idx" ON "StaffStationSkill"("stationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'StaffStationSkill') THEN
        CREATE  INDEX IF NOT EXISTS "StaffStationSkill_userId_idx" ON "StaffStationSkill"("userId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'StaffShift') THEN
        CREATE  INDEX IF NOT EXISTS "StaffShift_gamingCenterId_dayOfWeek_idx" ON "StaffShift"("gamingCenterId", "dayOfWeek");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'StaffShift') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "StaffShift_gamingCenterId_userId_dayOfWeek_key" ON "StaffShift"("gamingCenterId", "userId", "dayOfWeek");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_gamingCenterId_startTime_idx" ON "Reservation"("gamingCenterId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_gamingCenterId_staffId_startTime_idx" ON "Reservation"("gamingCenterId", "staffId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_gamingCenterId_status_startTime_idx" ON "Reservation"("gamingCenterId", "status", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_gamingCenterId_staffId_status_startTime_endTime_idx" ON "Reservation"("gamingCenterId", "staffId", "status", "startTime", "endTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_customerAccountId_startTime_idx" ON "Reservation"("customerAccountId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_customerProfileId_startTime_idx" ON "Reservation"("customerProfileId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_gamingCenterId_paymentState_startTime_idx" ON "Reservation"("gamingCenterId", "paymentState", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_groupBookingId_idx" ON "Reservation"("groupBookingId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Reservation') THEN
        CREATE  INDEX IF NOT EXISTS "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBooking') THEN
        CREATE  INDEX IF NOT EXISTS "GroupBooking_gamingCenterId_startTime_idx" ON "GroupBooking"("gamingCenterId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBooking') THEN
        CREATE  INDEX IF NOT EXISTS "GroupBooking_customerAccountId_startTime_idx" ON "GroupBooking"("customerAccountId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBooking') THEN
        CREATE  INDEX IF NOT EXISTS "GroupBooking_customerProfileId_startTime_idx" ON "GroupBooking"("customerProfileId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBooking') THEN
        CREATE  INDEX IF NOT EXISTS "GroupBooking_gamingCenterId_status_startTime_idx" ON "GroupBooking"("gamingCenterId", "status", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBooking') THEN
        CREATE  INDEX IF NOT EXISTS "GroupBooking_status_expiresAt_idx" ON "GroupBooking"("status", "expiresAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBookingItem') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "GroupBookingItem_reservationId_key" ON "GroupBookingItem"("reservationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBookingItem') THEN
        CREATE  INDEX IF NOT EXISTS "GroupBookingItem_groupBookingId_idx" ON "GroupBookingItem"("groupBookingId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBookingItem') THEN
        CREATE  INDEX IF NOT EXISTS "GroupBookingItem_stationId_idx" ON "GroupBookingItem"("stationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReservationTimeProposal') THEN
        CREATE  INDEX IF NOT EXISTS "ReservationTimeProposal_reservationId_status_idx" ON "ReservationTimeProposal"("reservationId", "status");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReservationTimeProposal') THEN
        CREATE  INDEX IF NOT EXISTS "ReservationTimeProposal_reservationId_createdAt_idx" ON "ReservationTimeProposal"("reservationId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReservationHistory') THEN
        CREATE  INDEX IF NOT EXISTS "ReservationHistory_reservationId_createdAt_idx" ON "ReservationHistory"("reservationId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'StationMaintenance') THEN
        CREATE  INDEX IF NOT EXISTS "StationMaintenance_stationId_startTime_idx" ON "StationMaintenance"("stationId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'StationMaintenance') THEN
        CREATE  INDEX IF NOT EXISTS "StationMaintenance_gamingCenterId_status_idx" ON "StationMaintenance"("gamingCenterId", "status");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsEvent') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "AnalyticsEvent_deduplicationKey_key" ON "AnalyticsEvent"("deduplicationKey");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsEvent') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsEvent_gamingCenterId_eventType_timestamp_idx" ON "AnalyticsEvent"("gamingCenterId", "eventType", "timestamp");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsEvent') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsEvent_visitorId_timestamp_idx" ON "AnalyticsEvent"("visitorId", "timestamp");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsEvent') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsEvent') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GamingCenterExpense') THEN
        CREATE  INDEX IF NOT EXISTS "GamingCenterExpense_gamingCenterId_status_expenseDate_idx" ON "GamingCenterExpense"("gamingCenterId", "status", "expenseDate");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GamingCenterExpense') THEN
        CREATE  INDEX IF NOT EXISTS "GamingCenterExpense_gamingCenterId_category_idx" ON "GamingCenterExpense"("gamingCenterId", "category");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MarketingCampaignSpend') THEN
        CREATE  INDEX IF NOT EXISTS "MarketingCampaignSpend_gamingCenterId_startDate_endDate_idx" ON "MarketingCampaignSpend"("gamingCenterId", "startDate", "endDate");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MarketingCampaignSpend') THEN
        CREATE  INDEX IF NOT EXISTS "MarketingCampaignSpend_campaignId_idx" ON "MarketingCampaignSpend"("campaignId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RevenueForecastRun') THEN
        CREATE  INDEX IF NOT EXISTS "RevenueForecastRun_gamingCenterId_createdAt_idx" ON "RevenueForecastRun"("gamingCenterId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Payment') THEN
        CREATE  INDEX IF NOT EXISTS "Payment_reservationId_paidAt_idx" ON "Payment"("reservationId", "paidAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Payment') THEN
        CREATE  INDEX IF NOT EXISTS "Payment_groupBookingId_paidAt_idx" ON "Payment"("groupBookingId", "paidAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Payment') THEN
        CREATE  INDEX IF NOT EXISTS "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Payment') THEN
        CREATE  INDEX IF NOT EXISTS "Payment_gamingCenterId_status_paidAt_idx" ON "Payment"("gamingCenterId", "status", "paidAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Payment') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Payment') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Payment_gamingCenterId_idempotencyKey_key" ON "Payment"("gamingCenterId", "idempotencyKey");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WalletTransaction') THEN
        CREATE  INDEX IF NOT EXISTS "WalletTransaction_customerAccountId_idx" ON "WalletTransaction"("customerAccountId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WalletTransaction') THEN
        CREATE  INDEX IF NOT EXISTS "WalletTransaction_reservationId_idx" ON "WalletTransaction"("reservationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WalletTransaction') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "WalletTransaction_reservationId_type_key" ON "WalletTransaction"("reservationId", "type");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CommissionPolicy') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "CommissionPolicy_gamingCenterId_key" ON "CommissionPolicy"("gamingCenterId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CommissionPolicy') THEN
        CREATE  INDEX IF NOT EXISTS "CommissionPolicy_gamingCenterId_isActive_idx" ON "CommissionPolicy"("gamingCenterId", "isActive");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Earning') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Earning_reservationId_key" ON "Earning"("reservationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Earning') THEN
        CREATE  INDEX IF NOT EXISTS "Earning_gamingCenterId_status_createdAt_idx" ON "Earning"("gamingCenterId", "status", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Earning') THEN
        CREATE  INDEX IF NOT EXISTS "Earning_gamingCenterId_targetPeriod_idx" ON "Earning"("gamingCenterId", "targetPeriod");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Earning') THEN
        CREATE  INDEX IF NOT EXISTS "Earning_chargedAt_idx" ON "Earning"("chargedAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'EarningPayment') THEN
        CREATE  INDEX IF NOT EXISTS "EarningPayment_earningId_paidAt_idx" ON "EarningPayment"("earningId", "paidAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'EarningPayment') THEN
        CREATE  INDEX IF NOT EXISTS "EarningPayment_status_paidAt_idx" ON "EarningPayment"("status", "paidAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Rating') THEN
        CREATE  INDEX IF NOT EXISTS "Rating_gamingCenterId_status_createdAt_idx" ON "Rating"("gamingCenterId", "status", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Rating') THEN
        CREATE  INDEX IF NOT EXISTS "Rating_stationId_status_createdAt_idx" ON "Rating"("stationId", "status", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Rating') THEN
        CREATE  INDEX IF NOT EXISTS "Rating_reservationId_idx" ON "Rating"("reservationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Rating') THEN
        CREATE  INDEX IF NOT EXISTS "Rating_customerAccountId_createdAt_idx" ON "Rating"("customerAccountId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Rating') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Rating_reservationId_stationId_key" ON "Rating"("reservationId", "stationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AuditLog') THEN
        CREATE  INDEX IF NOT EXISTS "AuditLog_gamingCenterId_createdAt_idx" ON "AuditLog"("gamingCenterId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AuditLog') THEN
        CREATE  INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AuditLog') THEN
        CREATE  INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Ticket') THEN
        CREATE  INDEX IF NOT EXISTS "Ticket_customerAccountId_idx" ON "Ticket"("customerAccountId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Ticket') THEN
        CREATE  INDEX IF NOT EXISTS "Ticket_assignedToUserId_idx" ON "Ticket"("assignedToUserId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Ticket') THEN
        CREATE  INDEX IF NOT EXISTS "Ticket_status_idx" ON "Ticket"("status");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Ticket') THEN
        CREATE  INDEX IF NOT EXISTS "Ticket_priority_idx" ON "Ticket"("priority");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Ticket') THEN
        CREATE  INDEX IF NOT EXISTS "Ticket_category_idx" ON "Ticket"("category");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Discount') THEN
        CREATE  INDEX IF NOT EXISTS "Discount_gamingCenterId_isActive_startAt_endAt_idx" ON "Discount"("gamingCenterId", "isActive", "startAt", "endAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Discount') THEN
        CREATE  INDEX IF NOT EXISTS "Discount_gamingCenterId_targetType_targetId_idx" ON "Discount"("gamingCenterId", "targetType", "targetId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DiscountCampaign') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "DiscountCampaign_code_key" ON "DiscountCampaign"("code");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DiscountCampaign') THEN
        CREATE  INDEX IF NOT EXISTS "DiscountCampaign_gamingCenterId_isActive_startAt_endAt_idx" ON "DiscountCampaign"("gamingCenterId", "isActive", "startAt", "endAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DiscountCampaign') THEN
        CREATE  INDEX IF NOT EXISTS "DiscountCampaign_code_idx" ON "DiscountCampaign"("code");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DiscountUsage') THEN
        CREATE  INDEX IF NOT EXISTS "DiscountUsage_campaignId_customerAccountId_idx" ON "DiscountUsage"("campaignId", "customerAccountId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DiscountUsage') THEN
        CREATE  INDEX IF NOT EXISTS "DiscountUsage_reservationId_idx" ON "DiscountUsage"("reservationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'TicketMessage') THEN
        CREATE  INDEX IF NOT EXISTS "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Notification') THEN
        CREATE  INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Notification') THEN
        CREATE  INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'NotificationLog') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "NotificationLog_idempotencyKey_key" ON "NotificationLog"("idempotencyKey");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'NotificationLog') THEN
        CREATE  INDEX IF NOT EXISTS "NotificationLog_status_scheduledAt_idx" ON "NotificationLog"("status", "scheduledAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'NotificationLog') THEN
        CREATE  INDEX IF NOT EXISTS "NotificationLog_status_nextRetryAt_idx" ON "NotificationLog"("status", "nextRetryAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'NotificationLog') THEN
        CREATE  INDEX IF NOT EXISTS "NotificationLog_entityType_entityId_idx" ON "NotificationLog"("entityType", "entityId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'NotificationLog') THEN
        CREATE  INDEX IF NOT EXISTS "NotificationLog_idempotencyKey_idx" ON "NotificationLog"("idempotencyKey");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'NotificationLog') THEN
        CREATE  INDEX IF NOT EXISTS "NotificationLog_gamingCenterId_createdAt_idx" ON "NotificationLog"("gamingCenterId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Refund') THEN
        CREATE  INDEX IF NOT EXISTS "Refund_paymentId_status_idx" ON "Refund"("paymentId", "status");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Refund') THEN
        CREATE  INDEX IF NOT EXISTS "Refund_gamingCenterId_status_createdAt_idx" ON "Refund"("gamingCenterId", "status", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Refund') THEN
        CREATE  INDEX IF NOT EXISTS "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Refund') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "Refund_gamingCenterId_idempotencyKey_key" ON "Refund"("gamingCenterId", "idempotencyKey");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LedgerEntry') THEN
        CREATE UNIQUE  INDEX IF NOT EXISTS "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LedgerEntry') THEN
        CREATE  INDEX IF NOT EXISTS "LedgerEntry_gamingCenterId_createdAt_idx" ON "LedgerEntry"("gamingCenterId", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LedgerEntry') THEN
        CREATE  INDEX IF NOT EXISTS "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LedgerEntry') THEN
        CREATE  INDEX IF NOT EXISTS "LedgerEntry_refundId_idx" ON "LedgerEntry"("refundId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LedgerEntry') THEN
        CREATE  INDEX IF NOT EXISTS "LedgerEntry_entryType_idx" ON "LedgerEntry"("entryType");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReconciliationRecord') THEN
        CREATE  INDEX IF NOT EXISTS "ReconciliationRecord_gamingCenterId_status_reconciledAt_idx" ON "ReconciliationRecord"("gamingCenterId", "status", "reconciledAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReconciliationRecord') THEN
        CREATE  INDEX IF NOT EXISTS "ReconciliationRecord_paymentId_idx" ON "ReconciliationRecord"("paymentId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WaitlistEntry') THEN
        CREATE  INDEX IF NOT EXISTS "WaitlistEntry_gamingCenterId_stationId_status_startTime_end_idx" ON "WaitlistEntry"("gamingCenterId", "stationId", "status", "startTime", "endTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WaitlistEntry') THEN
        CREATE  INDEX IF NOT EXISTS "WaitlistEntry_customerAccountId_status_idx" ON "WaitlistEntry"("customerAccountId", "status");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WaitlistEntry') THEN
        CREATE  INDEX IF NOT EXISTS "WaitlistEntry_status_createdAt_idx" ON "WaitlistEntry"("status", "createdAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WaitlistOffer') THEN
        CREATE  INDEX IF NOT EXISTS "WaitlistOffer_waitlistEntryId_status_idx" ON "WaitlistOffer"("waitlistEntryId", "status");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WaitlistOffer') THEN
        CREATE  INDEX IF NOT EXISTS "WaitlistOffer_gamingCenterId_status_expiresAt_idx" ON "WaitlistOffer"("gamingCenterId", "status", "expiresAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WaitlistOffer') THEN
        CREATE  INDEX IF NOT EXISTS "WaitlistOffer_status_expiresAt_idx" ON "WaitlistOffer"("status", "expiresAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsIngestionRun') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsIngestionRun_entity_startedAt_idx" ON "AnalyticsIngestionRun"("entity", "startedAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsIngestionRun') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsIngestionRun_status_startedAt_idx" ON "AnalyticsIngestionRun"("status", "startedAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsTenant') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsTenant_slug_idx" ON "AnalyticsTenant"("slug");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsTenant') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsTenant_isActive_idx" ON "AnalyticsTenant"("isActive");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsCustomer') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsCustomer_phone_idx" ON "AnalyticsCustomer"("phone");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsCustomer') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsCustomer_gamingCenterId_idx" ON "AnalyticsCustomer"("gamingCenterId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsStation') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsStation_gamingCenterId_isActive_idx" ON "AnalyticsStation"("gamingCenterId", "isActive");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsReservation') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsReservation_gamingCenterId_startTime_idx" ON "AnalyticsReservation"("gamingCenterId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsReservation') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsReservation_gamingCenterId_status_startTime_idx" ON "AnalyticsReservation"("gamingCenterId", "status", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsReservation') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsReservation_customerAccountId_startTime_idx" ON "AnalyticsReservation"("customerAccountId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsGamingSession') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsGamingSession_reservationId_idx" ON "AnalyticsGamingSession"("reservationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsGamingSession') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsGamingSession_stationId_startTime_idx" ON "AnalyticsGamingSession"("stationId", "startTime");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsGamingSession') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsGamingSession_gamingCenterId_idx" ON "AnalyticsGamingSession"("gamingCenterId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsPayment') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsPayment_gamingCenterId_status_paidAt_idx" ON "AnalyticsPayment"("gamingCenterId", "status", "paidAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsPayment') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsPayment_reservationId_idx" ON "AnalyticsPayment"("reservationId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsLedgerEntry') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsLedgerEntry_gamingCenterId_sourceCreatedAt_idx" ON "AnalyticsLedgerEntry"("gamingCenterId", "sourceCreatedAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsLedgerEntry') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsLedgerEntry_paymentId_idx" ON "AnalyticsLedgerEntry"("paymentId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsLedgerEntry') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsLedgerEntry_entryType_idx" ON "AnalyticsLedgerEntry"("entryType");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsRefund') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsRefund_gamingCenterId_status_sourceCreatedAt_idx" ON "AnalyticsRefund"("gamingCenterId", "status", "sourceCreatedAt");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnalyticsRefund') THEN
        CREATE  INDEX IF NOT EXISTS "AnalyticsRefund_paymentId_idx" ON "AnalyticsRefund"("paymentId");
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AuthorProfile" ADD CONSTRAINT "AuthorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AuthorProfile" ADD CONSTRAINT "AuthorProfile_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Media" ADD CONSTRAINT "Media_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Category" ADD CONSTRAINT "Category_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Tag" ADD CONSTRAINT "Tag_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Series" ADD CONSTRAINT "Series_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Post" ADD CONSTRAINT "Post_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AuthorProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Post" ADD CONSTRAINT "Post_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Post" ADD CONSTRAINT "Post_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Post" ADD CONSTRAINT "Post_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Revision" ADD CONSTRAINT "Revision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Revision" ADD CONSTRAINT "Revision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Comment" ADD CONSTRAINT "Comment_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReactionAggregate" ADD CONSTRAINT "ReactionAggregate_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Menu" ADD CONSTRAINT "Menu_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Page" ADD CONSTRAINT "Page_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Page" ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PageSection" ADD CONSTRAINT "PageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PageSlugHistory" ADD CONSTRAINT "PageSlugHistory_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PageMedia" ADD CONSTRAINT "PageMedia_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PageMedia" ADD CONSTRAINT "PageMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Address" ADD CONSTRAINT "Address_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Settings" ADD CONSTRAINT "Settings_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GameStation" ADD CONSTRAINT "GameStation_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "StaffStationSkill" ADD CONSTRAINT "StaffStationSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "StaffStationSkill" ADD CONSTRAINT "StaffStationSkill_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscountCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReservationTimeProposal" ADD CONSTRAINT "ReservationTimeProposal_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReservationTimeProposal" ADD CONSTRAINT "ReservationTimeProposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GamingSession" ADD CONSTRAINT "GamingSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GamingSession" ADD CONSTRAINT "GamingSession_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "StationMaintenance" ADD CONSTRAINT "StationMaintenance_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GamingCenterExpense" ADD CONSTRAINT "GamingCenterExpense_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MarketingCampaignSpend" ADD CONSTRAINT "MarketingCampaignSpend_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RevenueForecastRun" ADD CONSTRAINT "RevenueForecastRun_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Membership" ADD CONSTRAINT "Membership_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "CommissionPolicy_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Earning" ADD CONSTRAINT "Earning_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Earning" ADD CONSTRAINT "Earning_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "EarningPayment" ADD CONSTRAINT "EarningPayment_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "Earning"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Rating" ADD CONSTRAINT "Rating_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Rating" ADD CONSTRAINT "Rating_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Rating" ADD CONSTRAINT "Rating_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Rating" ADD CONSTRAINT "Rating_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Discount" ADD CONSTRAINT "Discount_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Discount" ADD CONSTRAINT "Discount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "DiscountCampaign" ADD CONSTRAINT "DiscountCampaign_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "DiscountCampaign" ADD CONSTRAINT "DiscountCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscountCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Refund" ADD CONSTRAINT "Refund_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
