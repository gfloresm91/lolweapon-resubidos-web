-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Anime" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEs" TEXT,
    "image" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "year" INTEGER,
    "episodes" INTEGER,
    "formatId" INTEGER,
    "releaseStatusId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeLibraryEntry" (
    "id" SERIAL NOT NULL,
    "animeId" INTEGER NOT NULL,
    "watchStatusId" INTEGER NOT NULL,
    "trackerTagId" INTEGER,
    "currentEpisode" INTEGER,
    "purchasedEpisodes" INTEGER,
    "isFullSeason" BOOLEAN NOT NULL DEFAULT false,
    "libraryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trackerUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeExternalReference" (
    "id" SERIAL NOT NULL,
    "animeId" INTEGER NOT NULL,
    "providerId" INTEGER NOT NULL,
    "providerMediaId" INTEGER,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalProvider" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExternalProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeFormat" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnimeFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeReleaseStatus" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnimeReleaseStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeWatchStatus" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnimeWatchStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagCategory" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TagCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Live" (
    "id" SERIAL NOT NULL,
    "legacyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "year" INTEGER,
    "statusId" INTEGER,
    "image" TEXT,
    "additionalInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Live_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStatus" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LiveStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTag" (
    "liveId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LiveTag_pkey" PRIMARY KEY ("liveId","tagId")
);

-- CreateTable
CREATE TABLE "LiveLink" (
    "id" SERIAL NOT NULL,
    "liveId" INTEGER NOT NULL,
    "platformId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LiveLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkPlatform" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LinkPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceDrum" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "status" TEXT,
    "coverImage" TEXT,
    "heroImage" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpaceDrum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceDrumMeta" (
    "id" SERIAL NOT NULL,
    "spaceDrumId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpaceDrumMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceDrumLink" (
    "id" SERIAL NOT NULL,
    "spaceDrumId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpaceDrumLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceDrumChapter" (
    "id" SERIAL NOT NULL,
    "spaceDrumId" INTEGER NOT NULL,
    "legacyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "releaseDate" TEXT,
    "summary" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpaceDrumChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceDrumPage" (
    "id" SERIAL NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "alt" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpaceDrumPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Anime_key_key" ON "Anime"("key");

-- CreateIndex
CREATE INDEX "Anime_formatId_idx" ON "Anime"("formatId");

-- CreateIndex
CREATE INDEX "Anime_releaseStatusId_idx" ON "Anime"("releaseStatusId");

-- CreateIndex
CREATE INDEX "Anime_year_idx" ON "Anime"("year");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeLibraryEntry_animeId_key" ON "AnimeLibraryEntry"("animeId");

-- CreateIndex
CREATE INDEX "AnimeLibraryEntry_watchStatusId_idx" ON "AnimeLibraryEntry"("watchStatusId");

-- CreateIndex
CREATE INDEX "AnimeLibraryEntry_trackerTagId_idx" ON "AnimeLibraryEntry"("trackerTagId");

-- CreateIndex
CREATE INDEX "AnimeLibraryEntry_libraryEnabled_idx" ON "AnimeLibraryEntry"("libraryEnabled");

-- CreateIndex
CREATE INDEX "AnimeLibraryEntry_isFullSeason_idx" ON "AnimeLibraryEntry"("isFullSeason");

-- CreateIndex
CREATE INDEX "AnimeLibraryEntry_deletedAt_idx" ON "AnimeLibraryEntry"("deletedAt");

-- CreateIndex
CREATE INDEX "AnimeExternalReference_animeId_idx" ON "AnimeExternalReference"("animeId");

-- CreateIndex
CREATE INDEX "AnimeExternalReference_providerId_idx" ON "AnimeExternalReference"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeExternalReference_animeId_providerId_key" ON "AnimeExternalReference"("animeId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeExternalReference_providerId_providerMediaId_key" ON "AnimeExternalReference"("providerId", "providerMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalProvider_code_key" ON "ExternalProvider"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeFormat_code_key" ON "AnimeFormat"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeReleaseStatus_code_key" ON "AnimeReleaseStatus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeWatchStatus_code_key" ON "AnimeWatchStatus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TagCategory_code_key" ON "TagCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_categoryId_idx" ON "Tag"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Live_legacyId_key" ON "Live"("legacyId");

-- CreateIndex
CREATE INDEX "Live_statusId_idx" ON "Live"("statusId");

-- CreateIndex
CREATE INDEX "Live_year_idx" ON "Live"("year");

-- CreateIndex
CREATE INDEX "Live_date_idx" ON "Live"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LiveStatus_code_key" ON "LiveStatus"("code");

-- CreateIndex
CREATE INDEX "LiveTag_tagId_idx" ON "LiveTag"("tagId");

-- CreateIndex
CREATE INDEX "LiveLink_liveId_idx" ON "LiveLink"("liveId");

-- CreateIndex
CREATE INDEX "LiveLink_platformId_idx" ON "LiveLink"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkPlatform_code_key" ON "LinkPlatform"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceDrum_key_key" ON "SpaceDrum"("key");

-- CreateIndex
CREATE INDEX "SpaceDrumMeta_spaceDrumId_idx" ON "SpaceDrumMeta"("spaceDrumId");

-- CreateIndex
CREATE INDEX "SpaceDrumLink_spaceDrumId_idx" ON "SpaceDrumLink"("spaceDrumId");

-- CreateIndex
CREATE INDEX "SpaceDrumChapter_spaceDrumId_idx" ON "SpaceDrumChapter"("spaceDrumId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceDrumChapter_spaceDrumId_legacyId_key" ON "SpaceDrumChapter"("spaceDrumId", "legacyId");

-- CreateIndex
CREATE INDEX "SpaceDrumPage_chapterId_idx" ON "SpaceDrumPage"("chapterId");

-- AddForeignKey
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "AnimeFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_releaseStatusId_fkey" FOREIGN KEY ("releaseStatusId") REFERENCES "AnimeReleaseStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeLibraryEntry" ADD CONSTRAINT "AnimeLibraryEntry_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeLibraryEntry" ADD CONSTRAINT "AnimeLibraryEntry_watchStatusId_fkey" FOREIGN KEY ("watchStatusId") REFERENCES "AnimeWatchStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeLibraryEntry" ADD CONSTRAINT "AnimeLibraryEntry_trackerTagId_fkey" FOREIGN KEY ("trackerTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeExternalReference" ADD CONSTRAINT "AnimeExternalReference_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeExternalReference" ADD CONSTRAINT "AnimeExternalReference_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ExternalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TagCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Live" ADD CONSTRAINT "Live_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "LiveStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTag" ADD CONSTRAINT "LiveTag_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "Live"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTag" ADD CONSTRAINT "LiveTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveLink" ADD CONSTRAINT "LiveLink_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "Live"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveLink" ADD CONSTRAINT "LiveLink_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LinkPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceDrumMeta" ADD CONSTRAINT "SpaceDrumMeta_spaceDrumId_fkey" FOREIGN KEY ("spaceDrumId") REFERENCES "SpaceDrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceDrumLink" ADD CONSTRAINT "SpaceDrumLink_spaceDrumId_fkey" FOREIGN KEY ("spaceDrumId") REFERENCES "SpaceDrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceDrumChapter" ADD CONSTRAINT "SpaceDrumChapter_spaceDrumId_fkey" FOREIGN KEY ("spaceDrumId") REFERENCES "SpaceDrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceDrumPage" ADD CONSTRAINT "SpaceDrumPage_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "SpaceDrumChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
