-- AlterTable
ALTER TABLE "AnimeSeason" ADD COLUMN     "createdSource" TEXT NOT NULL DEFAULT 'calendar';

-- Backfill: temporadas que nunca completaron un sync del Calendario (lastSyncedAt IS NULL)
-- probablemente existen solo por un side-effect del sync del Tier List.
UPDATE "AnimeSeason" SET "createdSource" = 'tierlist' WHERE "lastSyncedAt" IS NULL;
