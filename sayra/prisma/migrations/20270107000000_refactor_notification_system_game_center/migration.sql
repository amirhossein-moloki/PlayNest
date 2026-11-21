-- 1. Create or Update NotificationCategory enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationCategory') THEN
    CREATE TYPE "NotificationCategory" AS ENUM ('CUSTOMER', 'GAME_CENTER', 'MANAGER');
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'NotificationCategory' AND pg_enum.enumlabel = 'CUSTOMER'
    ) THEN
      ALTER TYPE "NotificationCategory" ADD VALUE 'CUSTOMER';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'NotificationCategory' AND pg_enum.enumlabel = 'GAME_CENTER'
    ) THEN
      ALTER TYPE "NotificationCategory" ADD VALUE 'GAME_CENTER';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'NotificationCategory' AND pg_enum.enumlabel = 'MANAGER'
    ) THEN
      ALTER TYPE "NotificationCategory" ADD VALUE 'MANAGER';
    END IF;
  END IF;
END $$;

-- 2. Alter NotificationType enum to add all domain event types
DO $$ BEGIN
  -- Customer Notifications
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'TICKET_CREATED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'TICKET_CREATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'TICKET_REPLIED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'TICKET_REPLIED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'TICKET_CLOSED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'TICKET_CLOSED';
  END IF;

  -- GameCenter Notifications
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'GAME_CENTER_BOOKING_REQUESTED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GAME_CENTER_BOOKING_REQUESTED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'GAME_CENTER_BOOKING_REMINDER_24H') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GAME_CENTER_BOOKING_REMINDER_24H';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'GAME_CENTER_BOOKING_REMINDER_2H') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GAME_CENTER_BOOKING_REMINDER_2H';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'GAME_CENTER_BOOKING_REMINDER_15M') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GAME_CENTER_BOOKING_REMINDER_15M';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'GAME_CENTER_BOOKING_CONFIRMED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GAME_CENTER_BOOKING_CONFIRMED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'GAME_CENTER_BOOKING_CANCELLED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GAME_CENTER_BOOKING_CANCELLED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'GAME_CENTER_BOOKING_UPDATED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GAME_CENTER_BOOKING_UPDATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'GAME_CENTER_REVIEW_RECEIVED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GAME_CENTER_REVIEW_RECEIVED';
  END IF;

  -- Manager Notifications
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'NEW_GAME_CENTER_REGISTRATION') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'NEW_GAME_CENTER_REGISTRATION';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'NEW_TICKET_CREATED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'NEW_TICKET_CREATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'NEW_USER_REPORT') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'NEW_USER_REPORT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'REFUND_REQUESTED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'REFUND_REQUESTED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'SYSTEM_ERROR') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM_ERROR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' AND pg_enum.enumlabel = 'DAILY_BOOKING_SUMMARY') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'DAILY_BOOKING_SUMMARY';
  END IF;
END $$;

-- 3. Add or update category columns
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Notification' AND column_name = 'category'
  ) THEN
    ALTER TABLE "Notification" ALTER COLUMN "category" SET DEFAULT 'GAME_CENTER';
  ELSE
    ALTER TABLE "Notification" ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'GAME_CENTER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'NotificationLog' AND column_name = 'category'
  ) THEN
    ALTER TABLE "NotificationLog" ALTER COLUMN "category" SET DEFAULT 'GAME_CENTER';
  ELSE
    ALTER TABLE "NotificationLog" ADD COLUMN "category" "NotificationCategory" DEFAULT 'GAME_CENTER';
  END IF;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_category_createdAt_idx" ON "Notification"("userId", "category", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationLog_category_status_scheduledAt_idx" ON "NotificationLog"("category", "status", "scheduledAt");
