-- CreateTable
CREATE TABLE "AnimeTierListEntry" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "aniListId" INTEGER NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "titleRomaji" TEXT NOT NULL,
    "titleEnglish" TEXT,
    "titleNative" TEXT,
    "imageUrl" TEXT,
    "format" TEXT,
    "episodes" INTEGER,
    "status" TEXT,
    "aniListUrl" TEXT,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "isDonghua" BOOLEAN NOT NULL DEFAULT false,
    "manualTitle" TEXT,
    "manualVisible" BOOLEAN,
    "sourceUpdatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeTierListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeTierListTheme" (
    "id" SERIAL NOT NULL,
    "tierListEntryId" INTEGER NOT NULL,
    "animeThemeId" INTEGER,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "songTitle" TEXT,
    "artist" TEXT,
    "videoUrl" TEXT,
    "videoResolution" INTEGER,
    "videoSource" TEXT,
    "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "manualType" TEXT,
    "manualSequence" INTEGER,
    "manualVideoUrl" TEXT,
    "manualVisible" BOOLEAN,
    "sourceUpdatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeTierListTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformUserAnimeTierList" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUserAnimeTierList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformUserAnimeTier" (
    "id" SERIAL NOT NULL,
    "tierListId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PlatformUserAnimeTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformUserAnimeTierPlacement" (
    "id" SERIAL NOT NULL,
    "tierListId" INTEGER NOT NULL,
    "tierId" INTEGER,
    "itemId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PlatformUserAnimeTierPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimeTierListEntry_seasonId_idx" ON "AnimeTierListEntry"("seasonId");

-- CreateIndex
CREATE INDEX "AnimeTierListEntry_deletedAt_idx" ON "AnimeTierListEntry"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeTierListEntry_seasonId_aniListId_key" ON "AnimeTierListEntry"("seasonId", "aniListId");

-- CreateIndex
CREATE INDEX "AnimeTierListTheme_tierListEntryId_idx" ON "AnimeTierListTheme"("tierListEntryId");

-- CreateIndex
CREATE INDEX "AnimeTierListTheme_type_idx" ON "AnimeTierListTheme"("type");

-- CreateIndex
CREATE INDEX "AnimeTierListTheme_deletedAt_idx" ON "AnimeTierListTheme"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeTierListTheme_tierListEntryId_animeThemeId_key" ON "AnimeTierListTheme"("tierListEntryId", "animeThemeId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUserAnimeTierList_shareToken_key" ON "PlatformUserAnimeTierList"("shareToken");

-- CreateIndex
CREATE INDEX "PlatformUserAnimeTierList_seasonId_idx" ON "PlatformUserAnimeTierList"("seasonId");

-- CreateIndex
CREATE INDEX "PlatformUserAnimeTierList_shareToken_idx" ON "PlatformUserAnimeTierList"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUserAnimeTierList_userId_seasonId_kind_key" ON "PlatformUserAnimeTierList"("userId", "seasonId", "kind");

-- CreateIndex
CREATE INDEX "PlatformUserAnimeTier_tierListId_idx" ON "PlatformUserAnimeTier"("tierListId");

-- CreateIndex
CREATE INDEX "PlatformUserAnimeTierPlacement_tierListId_idx" ON "PlatformUserAnimeTierPlacement"("tierListId");

-- CreateIndex
CREATE INDEX "PlatformUserAnimeTierPlacement_tierId_idx" ON "PlatformUserAnimeTierPlacement"("tierId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUserAnimeTierPlacement_tierListId_itemId_key" ON "PlatformUserAnimeTierPlacement"("tierListId", "itemId");

-- AddForeignKey
ALTER TABLE "AnimeTierListEntry" ADD CONSTRAINT "AnimeTierListEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "AnimeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeTierListTheme" ADD CONSTRAINT "AnimeTierListTheme_tierListEntryId_fkey" FOREIGN KEY ("tierListEntryId") REFERENCES "AnimeTierListEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserAnimeTierList" ADD CONSTRAINT "PlatformUserAnimeTierList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserAnimeTierList" ADD CONSTRAINT "PlatformUserAnimeTierList_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "AnimeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserAnimeTier" ADD CONSTRAINT "PlatformUserAnimeTier_tierListId_fkey" FOREIGN KEY ("tierListId") REFERENCES "PlatformUserAnimeTierList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserAnimeTierPlacement" ADD CONSTRAINT "PlatformUserAnimeTierPlacement_tierListId_fkey" FOREIGN KEY ("tierListId") REFERENCES "PlatformUserAnimeTierList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserAnimeTierPlacement" ADD CONSTRAINT "PlatformUserAnimeTierPlacement_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PlatformUserAnimeTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
