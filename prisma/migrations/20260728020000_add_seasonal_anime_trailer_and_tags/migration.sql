-- Trailer (AniList) y tags (filtrados de spoilers, top por rank) para el modal de detalle del calendario de temporada.
ALTER TABLE "SeasonalAnime" ADD COLUMN "trailerSite" TEXT;
ALTER TABLE "SeasonalAnime" ADD COLUMN "trailerId" TEXT;
ALTER TABLE "SeasonalAnime" ADD COLUMN "tags" JSONB;
