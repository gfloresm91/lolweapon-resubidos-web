import { buildSeasonalAnimeImport } from "./animeCalendarSources.js";
import { getPrismaClient } from "./prisma.js";

const VALID_SEASONS = new Set(["WINTER", "SPRING", "SUMMER", "FALL"]);

function validateSelection({ year, season }) {
  const normalizedYear = Number(year);
  const normalizedSeason = String(season || "").toUpperCase();
  if (!Number.isInteger(normalizedYear) || normalizedYear < 2000 || normalizedYear > 2100) {
    throw new Error("El año de la temporada no es válido.");
  }
  if (!VALID_SEASONS.has(normalizedSeason)) {
    throw new Error("La temporada no es válida.");
  }
  return { year: normalizedYear, season: normalizedSeason };
}

export async function previewSeasonalAnimeSync(selection) {
  const normalized = validateSelection(selection);
  const payload = await buildSeasonalAnimeImport(normalized);
  const prisma = getPrismaClient();
  const existing = await prisma.animeSeason.findUnique({
    where: { year_season: normalized },
    include: { animes: { include: { airings: true } } },
  });
  const existingAnimeIds = new Set((existing?.animes || []).map((anime) => anime.aniListId));
  const existingAiringKeys = new Set((existing?.animes || []).flatMap((anime) => (
    anime.airings.map((airing) => `${anime.aniListId}:${airing.sourceKey}`)
  )));
  const incomingAiringKeys = new Set(payload.animes.flatMap((anime) => (
    anime.airings.map((airing) => `${anime.aniListId}:${airing.sourceKey}`)
  )));

  return {
    selection: normalized,
    payload,
    summary: {
      animes: payload.animes.length,
      airings: incomingAiringKeys.size,
      newAnimes: payload.animes.filter((anime) => !existingAnimeIds.has(anime.aniListId)).length,
      newAirings: Array.from(incomingAiringKeys).filter((key) => !existingAiringKeys.has(key)).length,
      missingAirings: Array.from(existingAiringKeys).filter((key) => !incomingAiringKeys.has(key)).length,
      conflicts: payload.conflicts.length,
    },
  };
}

export async function applySeasonalAnimeSync(selection) {
  const preview = await previewSeasonalAnimeSync(selection);
  const prisma = getPrismaClient();
  const normalized = preview.selection;
  const season = await prisma.animeSeason.upsert({
    where: { year_season: normalized },
    update: { lastSyncStatus: "running" },
    create: { ...normalized, status: "draft", lastSyncStatus: "running" },
  });
  const sync = await prisma.seasonalAnimeSync.create({
    data: { seasonId: season.id, status: "running" },
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.seasonalAnime.updateMany({
        where: { seasonId: season.id },
        data: { sourceVisible: false },
      });

      for (const anime of preview.payload.animes) {
        const savedAnime = await tx.seasonalAnime.upsert({
          where: { seasonId_aniListId: { seasonId: season.id, aniListId: anime.aniListId } },
          update: {
            animeScheduleRoute: anime.animeScheduleRoute,
            titleRomaji: anime.titleRomaji,
            titleEnglish: anime.titleEnglish,
            titleNative: anime.titleNative,
            description: anime.description,
            imageUrl: anime.imageUrl,
            format: anime.format,
            episodes: anime.episodes,
            status: anime.status,
            aniListUrl: anime.aniListUrl,
            trailerSite: anime.trailerSite,
            trailerId: anime.trailerId,
            tags: anime.tags,
            isAdult: anime.isAdult,
            isDonghua: anime.isDonghua,
            sourceVisible: true,
            sourceUpdatedAt: anime.sourceUpdatedAt,
          },
          create: {
            seasonId: season.id,
            aniListId: anime.aniListId,
            animeScheduleRoute: anime.animeScheduleRoute,
            titleRomaji: anime.titleRomaji,
            titleEnglish: anime.titleEnglish,
            titleNative: anime.titleNative,
            description: anime.description,
            imageUrl: anime.imageUrl,
            format: anime.format,
            episodes: anime.episodes,
            status: anime.status,
            aniListUrl: anime.aniListUrl,
            trailerSite: anime.trailerSite,
            trailerId: anime.trailerId,
            tags: anime.tags,
            isAdult: anime.isAdult,
            isDonghua: anime.isDonghua,
            sourceUpdatedAt: anime.sourceUpdatedAt,
          },
        });

        await tx.seasonalAnimeAiring.updateMany({
          where: {
            seasonalAnimeId: savedAnime.id,
            sourceKey: { notIn: anime.airings.map((airing) => airing.sourceKey) },
          },
          data: { sourceStatus: "unconfirmed" },
        });

        for (const airing of anime.airings) {
          await tx.seasonalAnimeAiring.upsert({
            where: {
              seasonalAnimeId_sourceKey: {
                seasonalAnimeId: savedAnime.id,
                sourceKey: airing.sourceKey,
              },
            },
            update: {
              episode: airing.episode,
              sourceAiringAt: new Date(airing.airingAt),
              sourceStatus: airing.status,
              sourcePlatforms: airing.platforms,
              sourceUpdatedAt: new Date(),
            },
            create: {
              seasonalAnimeId: savedAnime.id,
              sourceKey: airing.sourceKey,
              episode: airing.episode,
              sourceAiringAt: new Date(airing.airingAt),
              sourceStatus: airing.status,
              sourcePlatforms: airing.platforms,
              sourceUpdatedAt: new Date(),
            },
          });
        }
      }

      await tx.animeSeason.update({
        where: { id: season.id },
        data: { lastSyncedAt: new Date(), lastSyncStatus: "success" },
      });
      await tx.seasonalAnimeSync.update({
        where: { id: sync.id },
        data: { status: "success", completedAt: new Date(), summary: preview.summary },
      });
    }, { timeout: 60000 });
    return { seasonId: season.id, summary: preview.summary };
  } catch (error) {
    await prisma.animeSeason.update({ where: { id: season.id }, data: { lastSyncStatus: "failed" } });
    await prisma.seasonalAnimeSync.update({
      where: { id: sync.id },
      data: { status: "failed", completedAt: new Date(), errorMessage: error.message },
    });
    throw error;
  }
}
