CREATE TABLE "AnimeSeason" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnimeSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonalAnime" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "aniListId" INTEGER NOT NULL,
    "animeScheduleRoute" TEXT,
    "titleRomaji" TEXT NOT NULL,
    "titleEnglish" TEXT,
    "titleNative" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "format" TEXT,
    "episodes" INTEGER,
    "status" TEXT,
    "aniListUrl" TEXT,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "isDonghua" BOOLEAN NOT NULL DEFAULT false,
    "sourceVisible" BOOLEAN NOT NULL DEFAULT true,
    "manualTitle" TEXT,
    "manualVisible" BOOLEAN,
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeasonalAnime_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonalAnimeAiring" (
    "id" SERIAL NOT NULL,
    "seasonalAnimeId" INTEGER NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "episode" INTEGER NOT NULL,
    "sourceAiringAt" TIMESTAMP(3) NOT NULL,
    "sourceStatus" TEXT NOT NULL DEFAULT 'scheduled',
    "sourcePlatform" TEXT,
    "sourceStreamingUrl" TEXT,
    "manualAiringAt" TIMESTAMP(3),
    "manualEpisode" INTEGER,
    "manualStatus" TEXT,
    "manualPlatform" TEXT,
    "manualStreamingUrl" TEXT,
    "manualVisible" BOOLEAN,
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeasonalAnimeAiring_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonalAnimeSync" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'animeschedule+anilist',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,
    "errorMessage" TEXT,
    CONSTRAINT "SeasonalAnimeSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnimeSeason_year_season_key" ON "AnimeSeason"("year", "season");
CREATE INDEX "AnimeSeason_status_idx" ON "AnimeSeason"("status");
CREATE INDEX "AnimeSeason_year_season_idx" ON "AnimeSeason"("year", "season");
CREATE UNIQUE INDEX "SeasonalAnime_seasonId_aniListId_key" ON "SeasonalAnime"("seasonId", "aniListId");
CREATE INDEX "SeasonalAnime_seasonId_idx" ON "SeasonalAnime"("seasonId");
CREATE INDEX "SeasonalAnime_aniListId_idx" ON "SeasonalAnime"("aniListId");
CREATE INDEX "SeasonalAnime_isAdult_idx" ON "SeasonalAnime"("isAdult");
CREATE INDEX "SeasonalAnime_isDonghua_idx" ON "SeasonalAnime"("isDonghua");
CREATE UNIQUE INDEX "SeasonalAnimeAiring_seasonalAnimeId_sourceKey_key" ON "SeasonalAnimeAiring"("seasonalAnimeId", "sourceKey");
CREATE INDEX "SeasonalAnimeAiring_seasonalAnimeId_idx" ON "SeasonalAnimeAiring"("seasonalAnimeId");
CREATE INDEX "SeasonalAnimeAiring_sourceAiringAt_idx" ON "SeasonalAnimeAiring"("sourceAiringAt");
CREATE INDEX "SeasonalAnimeAiring_sourceStatus_idx" ON "SeasonalAnimeAiring"("sourceStatus");
CREATE INDEX "SeasonalAnimeSync_seasonId_idx" ON "SeasonalAnimeSync"("seasonId");
CREATE INDEX "SeasonalAnimeSync_status_idx" ON "SeasonalAnimeSync"("status");
CREATE INDEX "SeasonalAnimeSync_startedAt_idx" ON "SeasonalAnimeSync"("startedAt");

ALTER TABLE "SeasonalAnime" ADD CONSTRAINT "SeasonalAnime_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "AnimeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonalAnimeAiring" ADD CONSTRAINT "SeasonalAnimeAiring_seasonalAnimeId_fkey" FOREIGN KEY ("seasonalAnimeId") REFERENCES "SeasonalAnime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonalAnimeSync" ADD CONSTRAINT "SeasonalAnimeSync_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "AnimeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlatformPermission" ("code", "label", "group", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('anime.calendar.view', 'Ver Calendario de temporada', 'Biblioteca de anime: Calendario de temporada', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('admin.anime.calendar.view', 'Ver Calendario de temporada', 'Administración: Calendario de temporada', 525, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('admin.anime.calendar.sync', 'Sincronizar temporadas', 'Administración: Calendario de temporada', 526, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('admin.anime.calendar.update', 'Editar calendario', 'Administración: Calendario de temporada', 527, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group" = EXCLUDED."group",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "PlatformRole" role
CROSS JOIN "PlatformPermission" permission
WHERE role."code" IN ('tw-tier-1', 'tw-tier-2', 'tw-tier-3', 'moderador', 'admin', 'streamer')
  AND permission."code" = 'anime.calendar.view'
ON CONFLICT DO NOTHING;

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "PlatformRole" role
CROSS JOIN "PlatformPermission" permission
WHERE role."code" = 'admin'
  AND permission."code" IN ('admin.anime.calendar.view', 'admin.anime.calendar.sync', 'admin.anime.calendar.update')
ON CONFLICT DO NOTHING;
