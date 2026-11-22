-- CreateEnum
CREATE TYPE "GamePlayMode" AS ENUM ('OFFLINE', 'ONLINE');

-- AlterTable
ALTER TABLE "GameCatalog" ADD COLUMN "supportsOnline" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "GameCatalog_supportsOnline_idx" ON "GameCatalog"("supportsOnline");

-- CreateTable
CREATE TABLE "GamingCenterGame" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "gameCatalogId" TEXT NOT NULL,
    "playMode" "GamePlayMode" NOT NULL DEFAULT 'OFFLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamingCenterGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamingCenterGame_gamingCenterId_gameCatalogId_key" ON "GamingCenterGame"("gamingCenterId", "gameCatalogId");

-- CreateIndex
CREATE INDEX "GamingCenterGame_gamingCenterId_idx" ON "GamingCenterGame"("gamingCenterId");

-- CreateIndex
CREATE INDEX "GamingCenterGame_gameCatalogId_idx" ON "GamingCenterGame"("gameCatalogId");

-- CreateIndex
CREATE INDEX "GamingCenterGame_gamingCenterId_playMode_idx" ON "GamingCenterGame"("gamingCenterId", "playMode");

-- AddForeignKey
ALTER TABLE "GamingCenterGame" ADD CONSTRAINT "GamingCenterGame_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingCenterGame" ADD CONSTRAINT "GamingCenterGame_gameCatalogId_fkey" FOREIGN KEY ("gameCatalogId") REFERENCES "GameCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing GamingCenter.games titles matching GameCatalog.title into GamingCenterGame as OFFLINE
INSERT INTO "GamingCenterGame" ("id", "gamingCenterId", "gameCatalogId", "playMode", "createdAt", "updatedAt")
SELECT DISTINCT ON (gc."id", gcat."id")
    'gcg_' || md5(gc."id" || ':' || gcat."id"),
    gc."id",
    gcat."id",
    'OFFLINE'::"GamePlayMode",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "GamingCenter" gc
CROSS JOIN LATERAL unnest(gc."games") AS game_title
INNER JOIN "GameCatalog" gcat ON gcat."title" = game_title
ORDER BY gc."id", gcat."id"
ON CONFLICT ("gamingCenterId", "gameCatalogId") DO NOTHING;
