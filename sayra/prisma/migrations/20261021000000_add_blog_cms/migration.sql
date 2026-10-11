-- Create new enums
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');
CREATE TYPE "SeriesOrderStrategy" AS ENUM ('MANUAL', 'BY_DATE');
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELETED');
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'ANGRY');
CREATE TYPE "MenuLocation" AS ENUM ('HEADER', 'FOOTER', 'SIDEBAR');
CREATE TYPE "MenuItemTargetType" AS ENUM ('PAGE', 'POST', 'CATEGORY', 'TAG', 'URL');
CREATE TYPE "NavigationVisibilityRule" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'STAFF', 'ADMIN');

-- Alter existing enums
ALTER TYPE "PageStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "PageStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'LANDING';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'LEGAL';

ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'AUDIO';
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'FILE';

ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'AVATAR';
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'POST_ATTACHMENT';

-- Alter existing tables (adding new columns safely)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isStaff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperuser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP(3);

ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "mime" TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "duration" INTEGER;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "uploadedById" TEXT;

ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "fullPath" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "depth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ(6);
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "content" TEXT;

-- Backfill Page "fullPath" with "slug" for existing records to support NOT NULL constraint
UPDATE "Page" SET "fullPath" = "slug" WHERE "fullPath" IS NULL;
ALTER TABLE "Page" ALTER COLUMN "fullPath" SET NOT NULL;

-- Create new tables
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

CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

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

-- Create new indexes & uniqueness constraints
CREATE UNIQUE INDEX "User_gamingCenterId_username_key" ON "User"("gamingCenterId", "username");
CREATE UNIQUE INDEX "User_gamingCenterId_email_key" ON "User"("gamingCenterId", "email");
CREATE UNIQUE INDEX "PostMedia_postId_mediaId_attachmentType_key" ON "PostMedia"("postId", "mediaId", "attachmentType");
CREATE INDEX "Category_gamingCenterId_slug_idx" ON "Category"("gamingCenterId", "slug");
CREATE UNIQUE INDEX "Category_gamingCenterId_slug_key" ON "Category"("gamingCenterId", "slug");
CREATE INDEX "Tag_gamingCenterId_slug_idx" ON "Tag"("gamingCenterId", "slug");
CREATE UNIQUE INDEX "Tag_gamingCenterId_slug_key" ON "Tag"("gamingCenterId", "slug");
CREATE INDEX "Series_gamingCenterId_slug_idx" ON "Series"("gamingCenterId", "slug");
CREATE UNIQUE INDEX "Series_gamingCenterId_slug_key" ON "Series"("gamingCenterId", "slug");
CREATE INDEX "Post_gamingCenterId_status_idx" ON "Post"("gamingCenterId", "status");
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");
CREATE UNIQUE INDEX "Post_gamingCenterId_slug_key" ON "Post"("gamingCenterId", "slug");
CREATE INDEX "Comment_gamingCenterId_postId_status_isActive_idx" ON "Comment"("gamingCenterId", "postId", "status", "isActive");
CREATE INDEX "Comment_rootId_status_isActive_idx" ON "Comment"("rootId", "status", "isActive");
CREATE INDEX "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt");
CREATE INDEX "Reaction_contentType_objectId_idx" ON "Reaction"("contentType", "objectId");
CREATE INDEX "Reaction_gamingCenterId_idx" ON "Reaction"("gamingCenterId");
CREATE UNIQUE INDEX "Reaction_userId_contentType_objectId_key" ON "Reaction"("userId", "contentType", "objectId");
CREATE INDEX "ReactionAggregate_gamingCenterId_idx" ON "ReactionAggregate"("gamingCenterId");
CREATE INDEX "ReactionAggregate_contentType_objectId_idx" ON "ReactionAggregate"("contentType", "objectId");
CREATE UNIQUE INDEX "ReactionAggregate_contentType_objectId_type_key" ON "ReactionAggregate"("contentType", "objectId", "type");
CREATE UNIQUE INDEX "Menu_gamingCenterId_location_key" ON "Menu"("gamingCenterId", "location");
CREATE INDEX "Page_fullPath_idx" ON "Page"("fullPath");
CREATE UNIQUE INDEX "Page_gamingCenterId_fullPath_key" ON "Page"("gamingCenterId", "fullPath");
CREATE UNIQUE INDEX "PageMedia_pageId_mediaId_attachmentType_key" ON "PageMedia"("pageId", "mediaId", "attachmentType");

-- Add newly introduced foreign key constraints
ALTER TABLE "AuthorProfile" ADD CONSTRAINT "AuthorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthorProfile" ADD CONSTRAINT "AuthorProfile_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Category" ADD CONSTRAINT "Category_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tag" ADD CONSTRAINT "Tag_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Series" ADD CONSTRAINT "Series_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AuthorProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Revision" ADD CONSTRAINT "Revision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReactionAggregate" ADD CONSTRAINT "ReactionAggregate_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Menu" ADD CONSTRAINT "Menu_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PageMedia" ADD CONSTRAINT "PageMedia_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageMedia" ADD CONSTRAINT "PageMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Page" ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
