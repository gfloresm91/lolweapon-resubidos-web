import { getPrismaClient } from "../prisma.js";
import { SEASON_LABELS } from "../animeTierListLabels.js";

// Orden cronológico de trimestres (no alfabético): define el orden de las claves de SEASON_LABELS.
const SEASON_ORDER = Object.keys(SEASON_LABELS);

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function getTrailerUrl(site, id) {
  if (!site || !id) return null;
  if (site === "youtube") return `https://www.youtube.com/embed/${id}`;
  if (site === "dailymotion") return `https://www.dailymotion.com/embed/video/${id}`;
  return null;
}

function normalizePlatformUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  // Datos sincronizados antes de la corrección de origen pueden tener la URL sin protocolo.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function compactAiring(row) {
  const sourcePlatforms = (Array.isArray(row.sourcePlatforms) ? row.sourcePlatforms : [])
    .map((platform) => ({ name: platform?.name || null, url: normalizePlatformUrl(platform?.url) }));
  const hasManualPlatform = Boolean(row.manualPlatform || row.manualStreamingUrl);
  const platforms = hasManualPlatform
    ? [{
      name: row.manualPlatform || sourcePlatforms[0]?.name || null,
      url: normalizePlatformUrl(row.manualStreamingUrl) || sourcePlatforms[0]?.url || null,
    }]
    : sourcePlatforms;

  return {
    id: row.id,
    sourceKey: row.sourceKey,
    episode: row.manualEpisode ?? row.episode,
    airingAt: (row.manualAiringAt || row.sourceAiringAt).toISOString(),
    status: row.manualStatus || row.sourceStatus,
    platforms,
    isVisible: row.manualVisible ?? row.sourceStatus !== "unconfirmed",
    manualAiringAt: row.manualAiringAt?.toISOString() || null,
    manualEpisode: row.manualEpisode,
    manualStatus: row.manualStatus,
    manualPlatform: row.manualPlatform,
    manualStreamingUrl: row.manualStreamingUrl,
    manualVisible: row.manualVisible,
    hasOverrides: Boolean(
      row.manualAiringAt
      || row.manualEpisode != null
      || row.manualStatus
      || row.manualPlatform
      || row.manualStreamingUrl
      || row.manualVisible != null
    ),
  };
}

function compactAnime(row, favoriteAniListIds = null) {
  return {
    id: row.id,
    aniListId: row.aniListId,
    animeScheduleRoute: row.animeScheduleRoute,
    title: row.manualTitle || row.titleRomaji,
    titleRomaji: row.titleRomaji,
    titleEnglish: row.titleEnglish,
    titleNative: row.titleNative,
    description: row.description,
    imageUrl: row.imageUrl,
    format: row.format,
    episodes: row.episodes,
    status: row.status,
    aniListUrl: row.aniListUrl,
    trailerUrl: getTrailerUrl(row.trailerSite, row.trailerId),
    tags: Array.isArray(row.tags) ? row.tags : [],
    isAdult: row.isAdult,
    isDonghua: row.isDonghua,
    isVisible: row.manualVisible ?? row.sourceVisible,
    isFavorite: favoriteAniListIds ? favoriteAniListIds.has(row.aniListId) : false,
    manualTitle: row.manualTitle,
    manualVisible: row.manualVisible,
    hasOverrides: Boolean(row.manualTitle || row.manualVisible != null),
    airings: (row.airings || []).map(compactAiring),
  };
}

function compactSeason(row, includeAnime = true, favoriteAniListIds = null) {
  return {
    id: row.id,
    year: row.year,
    season: row.season,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt?.toISOString() || null,
    lastSyncStatus: row.lastSyncStatus,
    animes: includeAnime ? (row.animes || []).map((anime) => compactAnime(anime, favoriteAniListIds)) : undefined,
  };
}

async function getFavoriteAniListIds(userId) {
  if (!userId) return null;
  const prisma = getPrismaClient();
  const rows = await prisma.platformUserSeasonalAnimeFavorite.findMany({
    where: { userId },
    select: { aniListId: true },
  });
  return new Set(rows.map((row) => row.aniListId));
}

export async function listAnimeSeasons() {
  if (!usePostgres()) return [];
  const prisma = getPrismaClient();
  // Solo temporadas sincronizadas alguna vez desde el Calendario: el Tier List puede crear
  // filas de AnimeSeason como efecto colateral de su propio sync y no deben listarse acá.
  const rows = await prisma.animeSeason.findMany({ where: { createdSource: "calendar" } });
  // `season` es un string (WINTER/SPRING/SUMMER/FALL): ordenarlo alfabéticamente no refleja
  // el orden cronológico real de los trimestres, por eso se ordena a mano con SEASON_ORDER.
  return rows
    .map((row) => compactSeason(row, false))
    .sort((left, right) => (
      right.year - left.year || SEASON_ORDER.indexOf(right.season) - SEASON_ORDER.indexOf(left.season)
    ));
}

export async function getSeasonalAnimeCalendar({ seasonId = null, userId = null } = {}) {
  if (!usePostgres()) return { seasons: [], activeSeason: null };
  const prisma = getPrismaClient();
  const seasons = await listAnimeSeasons();
  const hasRequestedId = seasonId !== null && seasonId !== undefined && String(seasonId).trim() !== "";
  const requestedId = hasRequestedId ? Number(seasonId) : null;
  const selected = Number.isInteger(requestedId)
    ? seasons.find((season) => season.id === requestedId)
    : seasons.find((season) => season.status === "active") || seasons[0];

  if (!selected) return { seasons, activeSeason: null };

  const [row, favoriteAniListIds] = await Promise.all([
    prisma.animeSeason.findUnique({
      where: { id: selected.id },
      include: {
        animes: {
          orderBy: [{ titleRomaji: "asc" }],
          include: { airings: { orderBy: [{ sourceAiringAt: "asc" }, { episode: "asc" }] } },
        },
      },
    }),
    getFavoriteAniListIds(userId),
  ]);
  return { seasons, activeSeason: compactSeason(row, true, favoriteAniListIds) };
}

export async function toggleSeasonalAnimeFavorite(userId, aniListId, isFavorite) {
  if (!userId) throw new Error("No autorizado.");
  const normalizedAniListId = Number(aniListId);
  if (!Number.isInteger(normalizedAniListId) || normalizedAniListId <= 0) {
    throw new Error("Anime inválido.");
  }
  const prisma = getPrismaClient();
  if (isFavorite) {
    await prisma.platformUserSeasonalAnimeFavorite.upsert({
      where: { userId_aniListId: { userId, aniListId: normalizedAniListId } },
      update: {},
      create: { userId, aniListId: normalizedAniListId },
    });
  } else {
    await prisma.platformUserSeasonalAnimeFavorite.deleteMany({
      where: { userId, aniListId: normalizedAniListId },
    });
  }
  return { aniListId: normalizedAniListId, isFavorite: Boolean(isFavorite) };
}

export async function getSeasonalAnimeAdminData({ seasonId = null } = {}) {
  const calendar = await getSeasonalAnimeCalendar({ seasonId });
  if (!usePostgres()) return { ...calendar, recentSyncs: [] };
  const prisma = getPrismaClient();
  const recentSyncs = await prisma.seasonalAnimeSync.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
    include: { season: true },
  });
  return {
    ...calendar,
    recentSyncs: recentSyncs.map((sync) => ({
      id: sync.id,
      year: sync.season.year,
      season: sync.season.season,
      status: sync.status,
      startedAt: sync.startedAt.toISOString(),
      completedAt: sync.completedAt?.toISOString() || null,
      summary: sync.summary,
      errorMessage: sync.errorMessage,
    })),
  };
}

export async function setActiveAnimeSeason(id) {
  const prisma = getPrismaClient();
  const seasonId = Number(id);
  return prisma.$transaction(async (tx) => {
    await tx.animeSeason.updateMany({ where: { status: "active" }, data: { status: "archived" } });
    const row = await tx.animeSeason.update({ where: { id: seasonId }, data: { status: "active" } });
    return compactSeason(row, false);
  });
}

export async function updateSeasonalAnimeOverride(input) {
  const prisma = getPrismaClient();
  const id = Number(input?.id);
  const row = await prisma.seasonalAnime.update({
    where: { id },
    data: {
      manualTitle: input.manualTitle === "" ? null : input.manualTitle,
      manualVisible: typeof input.manualVisible === "boolean" ? input.manualVisible : null,
    },
    include: { airings: { orderBy: { sourceAiringAt: "asc" } } },
  });
  return compactAnime(row);
}

export async function updateSeasonalAiringOverride(input) {
  const prisma = getPrismaClient();
  const id = Number(input?.id);
  const manualDate = input.manualAiringAt ? new Date(input.manualAiringAt) : null;
  if (manualDate && Number.isNaN(manualDate.getTime())) throw new Error("La fecha manual no es válida.");
  const row = await prisma.seasonalAnimeAiring.update({
    where: { id },
    data: {
      manualAiringAt: manualDate,
      manualEpisode: input.manualEpisode ? Number(input.manualEpisode) : null,
      manualStatus: input.manualStatus || null,
      manualPlatform: input.manualPlatform || null,
      manualStreamingUrl: input.manualStreamingUrl || null,
      manualVisible: typeof input.manualVisible === "boolean" ? input.manualVisible : null,
    },
  });
  return compactAiring(row);
}
