import { fetchAnimeThemesByAniListIds } from "./animeThemesSource.js";
import { buildAnimeTierListEntryImport } from "./animeTierListSources.js";
import { getPrismaClient } from "./prisma.js";
import { createAnimeTierListEntry } from "./repositories/animeTierListEntryRepository.js";

function themeScore(theme) {
  return (theme.isNsfw ? 0 : 1) * 1000 + (theme.videoResolution || 0);
}

function dedupeThemesBySequence(themes) {
  const bestByKey = new Map();
  for (const theme of themes) {
    const key = `${theme.type}:${theme.sequence}`;
    const current = bestByKey.get(key);
    if (!current || themeScore(theme) > themeScore(current)) bestByKey.set(key, theme);
  }
  return Array.from(bestByKey.values());
}

async function findMissingAniListEntries(season, existingAniListIds) {
  try {
    const { entries } = await buildAnimeTierListEntryImport({ year: season.year, season: season.season });
    return { entries: entries.filter((entry) => !existingAniListIds.has(entry.aniListId)), error: null };
  } catch (error) {
    // Si AniList falla o limita las consultas, el resto del sync (AnimeThemes.moe) igual debe poder correr.
    return { entries: [], error: error.message || "No se pudo consultar AniList." };
  }
}

export async function previewAnimeTierListThemeSync({ seasonId }) {
  const normalizedSeasonId = Number(seasonId);
  const prisma = getPrismaClient();
  const season = await prisma.animeSeason.findUnique({ where: { id: normalizedSeasonId } });
  const entries = await prisma.animeTierListEntry.findMany({
    where: { seasonId: normalizedSeasonId, deletedAt: null },
  });

  // Se incluyen también las entradas eliminadas (soft-delete) al armar el set de "ya existentes":
  // si se excluyeran, el sync las volvería a proponer como nuevas y las revivirla en cada corrida.
  const allEntryAniListIds = await prisma.animeTierListEntry.findMany({
    where: { seasonId: normalizedSeasonId, aniListId: { not: null } },
    select: { aniListId: true },
  });
  const existingAniListIds = new Set(allEntryAniListIds.map((entry) => entry.aniListId));
  const missing = season
    ? await findMissingAniListEntries(season, existingAniListIds)
    : { entries: [], error: null };

  if (!entries.length) {
    return {
      seasonId: normalizedSeasonId,
      entries: [],
      themesByEntry: new Map(),
      summary: {
        animes: 0,
        themes: 0,
        newThemes: 0,
        newEntriesFromAniList: missing.entries.length,
        aniListError: missing.error,
      },
      newEntryTitles: missing.entries.map((entry) => entry.titleRomaji),
    };
  }

  const themesByAniListId = await fetchAnimeThemesByAniListIds(entries.map((entry) => entry.aniListId));
  const existingThemes = await prisma.animeTierListTheme.findMany({
    where: { tierListEntryId: { in: entries.map((entry) => entry.id) }, isManual: false },
  });
  const existingKeys = new Set(existingThemes.map((theme) => `${theme.tierListEntryId}:${theme.animeThemeId}`));

  const themesByEntry = new Map();
  let totalThemes = 0;
  let newThemes = 0;

  for (const entry of entries) {
    const themes = dedupeThemesBySequence(themesByAniListId.get(entry.aniListId) || []);
    themesByEntry.set(entry.id, themes);
    totalThemes += themes.length;
    for (const theme of themes) {
      if (!existingKeys.has(`${entry.id}:${theme.animeThemeId}`)) newThemes += 1;
    }
  }

  return {
    seasonId: normalizedSeasonId,
    entries,
    themesByEntry,
    summary: {
      animes: entries.filter((entry) => (themesByEntry.get(entry.id) || []).length > 0).length,
      themes: totalThemes,
      newThemes,
      newEntriesFromAniList: missing.entries.length,
      aniListError: missing.error,
    },
    newEntryTitles: missing.entries.map((entry) => entry.titleRomaji),
  };
}

export async function applyAnimeTierListThemeSync({ seasonId }) {
  const normalizedSeasonId = Number(seasonId);
  const prisma = getPrismaClient();
  const season = await prisma.animeSeason.findUnique({ where: { id: normalizedSeasonId } });

  let addedEntries = 0;
  let aniListError = null;

  if (season) {
    // Incluye entradas eliminadas para no revivirlas al detectarlas como "faltantes".
    const existing = await prisma.animeTierListEntry.findMany({
      where: { seasonId: normalizedSeasonId, aniListId: { not: null } },
      select: { aniListId: true },
    });
    const existingAniListIds = new Set(existing.map((entry) => entry.aniListId));
    const missing = await findMissingAniListEntries(season, existingAniListIds);
    aniListError = missing.error;
    for (const entry of missing.entries) {
      await createAnimeTierListEntry({ seasonId: normalizedSeasonId, aniListId: entry.aniListId });
      addedEntries += 1;
    }
  }

  const preview = await previewAnimeTierListThemeSync({ seasonId });

  await prisma.$transaction(async (tx) => {
    for (const entry of preview.entries) {
      const themes = preview.themesByEntry.get(entry.id) || [];
      for (const theme of themes) {
        const data = {
          type: theme.type,
          sequence: theme.sequence,
          songTitle: theme.songTitle,
          artist: theme.artist,
          videoUrl: theme.videoUrl,
          videoResolution: theme.videoResolution,
          videoSource: theme.videoSource,
          isNsfw: theme.isNsfw,
          sourceUpdatedAt: theme.sourceUpdatedAt,
        };
        await tx.animeTierListTheme.upsert({
          where: {
            tierListEntryId_animeThemeId: {
              tierListEntryId: entry.id,
              animeThemeId: theme.animeThemeId,
            },
          },
          // Un tema nuevo nace publicado; uno ya existente conserva su manualVisible actual
          // (no se pisa el borrador/ocultar que haya decidido un admin).
          update: data,
          create: { tierListEntryId: entry.id, animeThemeId: theme.animeThemeId, ...data, manualVisible: true },
        });
      }
    }
  }, { timeout: 60000 });

  return { seasonId: preview.seasonId, summary: { ...preview.summary, addedEntries, aniListError } };
}
