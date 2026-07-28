-- Reemplaza sourcePlatform/sourceStreamingUrl (una sola plataforma) por sourcePlatforms (todas las fuentes de streaming reportadas por AnimeSchedule).
ALTER TABLE "SeasonalAnimeAiring" DROP COLUMN "sourcePlatform";
ALTER TABLE "SeasonalAnimeAiring" DROP COLUMN "sourceStreamingUrl";
ALTER TABLE "SeasonalAnimeAiring" ADD COLUMN "sourcePlatforms" JSONB;
