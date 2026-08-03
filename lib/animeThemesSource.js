const DEFAULT_ANIME_THEMES_API_URL = "https://graphql.animethemes.moe/";
const SOURCE_PRIORITY = { BD: 3, WEB: 2, DVD: 1, VHS: 0, LD: 0, RAW: 0 };
const BATCH_SIZE = 25;

const ANIME_THEMES_QUERY = `
  query SeasonalAnimeThemes($ids: [Int!]) {
    findAnimeByExternalSite(site: ANILIST, id: $ids) {
      resources { nodes { site externalId } }
      animethemes {
        id
        type
        sequence
        song { title { romaji } }
        animethemeentries {
          version
          spoiler
          nsfw
          videos { nodes { basename link resolution source } }
        }
      }
    }
  }
`;

async function fetchJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => null);

  if (response.status === 429) {
    throw new Error("AnimeThemes.moe está limitando las consultas. Intenta nuevamente más tarde.");
  }
  if (!response.ok || !data) {
    throw new Error(`No se pudo consultar AnimeThemes.moe (HTTP ${response.status}).`);
  }
  return data;
}

function pickBestVideo(entry) {
  const videos = entry?.videos?.nodes || [];
  if (!videos.length) return null;
  return [...videos].sort((left, right) => {
    const resolutionDiff = (right.resolution || 0) - (left.resolution || 0);
    if (resolutionDiff !== 0) return resolutionDiff;
    return (SOURCE_PRIORITY[right.source] ?? 0) - (SOURCE_PRIORITY[left.source] ?? 0);
  })[0];
}

function pickBestEntry(entries) {
  const withVideo = (entries || []).filter((entry) => entry?.videos?.nodes?.length);
  if (!withVideo.length) return null;
  return withVideo.find((entry) => !entry.nsfw) || withVideo[0];
}

function normalizeTheme(theme) {
  const entry = pickBestEntry(theme.animethemeentries);
  if (!entry) return null;
  const video = pickBestVideo(entry);
  if (!video) return null;

  return {
    animeThemeId: theme.id,
    type: theme.type === "ED" ? "ED" : "OP",
    sequence: Number.isInteger(theme.sequence) ? theme.sequence : 1,
    songTitle: theme.song?.title?.romaji || null,
    artist: null,
    videoUrl: video.link,
    videoResolution: video.resolution || null,
    videoSource: video.source || null,
    isNsfw: Boolean(entry.nsfw),
    sourceUpdatedAt: new Date(),
  };
}

export async function fetchAnimeThemesByAniListIds(aniListIds) {
  const baseUrl = String(process.env.ANIME_THEMES_API_BASE_URL || DEFAULT_ANIME_THEMES_API_URL);
  const uniqueIds = Array.from(new Set(aniListIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  const result = new Map();

  for (let index = 0; index < uniqueIds.length; index += BATCH_SIZE) {
    const idBatch = uniqueIds.slice(index, index + BATCH_SIZE);
    const data = await fetchJson(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "lolweapon-resubidos-web/1.0 (+https://viendo.lolweapon.com)",
      },
      body: JSON.stringify({ query: ANIME_THEMES_QUERY, variables: { ids: idBatch } }),
      cache: "no-store",
    });

    if (data?.errors?.length) {
      throw new Error(data.errors[0]?.message || "AnimeThemes.moe devolvió un error.");
    }

    for (const anime of data?.data?.findAnimeByExternalSite || []) {
      const aniListId = anime.resources?.nodes?.find((node) => node.site === "ANILIST")?.externalId;
      if (!aniListId) continue;
      const themes = (anime.animethemes || [])
        .map(normalizeTheme)
        .filter(Boolean);
      result.set(Number(aniListId), themes);
    }
  }

  return result;
}
