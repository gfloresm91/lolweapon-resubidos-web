-- Rename score storage to tenths so decimal ratings can be stored as integers.
ALTER TABLE "AnimeRating" RENAME COLUMN "score" TO "scoreTenths";

-- Existing integer ratings become decimal-safe tenths: 8 -> 80, 7 -> 70.
UPDATE "AnimeRating" SET "scoreTenths" = "scoreTenths" * 10;
