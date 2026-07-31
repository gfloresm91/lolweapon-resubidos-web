-- AlterTable
ALTER TABLE "AnimeTierListTheme" ADD COLUMN     "manualPrimarySourceLabel" TEXT,
ADD COLUMN     "alternateVideoUrls" JSONB;

-- Backfill: preserve existing single alternate source as the first item of the new array
UPDATE "AnimeTierListTheme"
SET "alternateVideoUrls" = jsonb_build_array(jsonb_build_object('label', 'Fuente alternativa', 'url', "alternateVideoUrl"))
WHERE "alternateVideoUrl" IS NOT NULL;

-- AlterTable
ALTER TABLE "AnimeTierListTheme" DROP COLUMN "alternateVideoUrl";
