const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const DEFAULT_ANIME_SCHEDULE_API_URL = "https://animeschedule.net/api/v3";
const SEASON_MONTHS = {
  WINTER: [0, 2],
  SPRING: [3, 5],
  SUMMER: [6, 8],
  FALL: [9, 11],
};

const MAX_TAGS = 8;

const aniListMediaFields = `
  id
  siteUrl
  title { romaji english native }
  description(asHtml: false)
  format
  status
  episodes
  countryOfOrigin
  isAdult
  updatedAt
  coverImage { extraLarge large }
  trailer { id site }
  tags { name rank isGeneralSpoiler isMediaSpoiler isAdult }
`;

function normalizeTags(tags) {
  return (Array.isArray(tags) ? tags : [])
    .filter((tag) => tag?.name && !tag.isGeneralSpoiler && !tag.isMediaSpoiler && !tag.isAdult)
    .sort((left, right) => (right.rank || 0) - (left.rank || 0))
    .slice(0, MAX_TAGS)
    .map((tag) => tag.name);
}

function cleanText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getIsoWeek(date) {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  return {
    year: current.getUTCFullYear(),
    week: Math.ceil((((current - yearStart) / 86400000) + 1) / 7),
  };
}

function getSeasonWeeks(year, season) {
  const [startMonth, endMonth] = SEASON_MONTHS[season] || SEASON_MONTHS.WINTER;
  const cursor = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, endMonth + 1, 0));
  const weeks = new Map();

  while (cursor <= end) {
    const item = getIsoWeek(cursor);
    weeks.set(`${item.year}-${item.week}`, item);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  const last = getIsoWeek(end);
  weeks.set(`${last.year}-${last.week}`, last);
  return Array.from(weeks.values());
}

function getAniListId(item) {
  const direct = Number(item?.aniListId || item?.anilistId || item?.anilistID);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const url = item?.websites?.aniList || item?.websites?.anilist || item?.aniList || item?.anilist || "";
  const match = String(url).match(/anilist\.co\/anime\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

function normalizeStreamUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  // AnimeSchedule a veces entrega la URL sin protocolo (ej. "www.crunchyroll.com/..."),
  // lo que la convierte en un link relativo dentro de nuestra app si se usa tal cual.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function getStreams(item) {
  const streams = Array.isArray(item?.streams) ? item.streams : [];
  const normalized = streams
    .map((entry) => ({
      name: entry?.name || entry?.platform || entry?.title || null,
      url: normalizeStreamUrl(entry?.url),
    }))
    .filter((entry) => entry.name || entry.url);
  const seen = new Set();
  return normalized.filter((entry) => {
    const dedupeKey = `${entry.name || ""}:${entry.url || ""}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
}

function normalizeTimetableItem(item) {
  const airingAt = item?.episodeDate || item?.datetime || item?.airingAt || item?.date;
  const parsedDate = airingAt ? new Date(airingAt) : null;
  const episode = Number(item?.episodeNumber || item?.episode || 0);
  const aniListId = getAniListId(item);
  const route = String(item?.route || item?.slug || item?.animeRoute || "").trim();
  const platforms = getStreams(item);

  if (!aniListId || !parsedDate || Number.isNaN(parsedDate.getTime()) || !Number.isInteger(episode) || episode < 1) {
    return null;
  }

  return {
    aniListId,
    route: route || null,
    episode,
    airingAt: parsedDate.toISOString(),
    status: String(item?.airingStatus || item?.status || "scheduled").toLowerCase(),
    platforms,
    sourceKey: String(item?.id || `${route || aniListId}:sub:${episode}:${parsedDate.toISOString()}`),
  };
}

async function fetchJson(url, options, sourceLabel, { allowNotFound = false } = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => null);

  if (response.status === 429) {
    throw new Error(`${sourceLabel} está limitando las consultas. Intenta nuevamente más tarde.`);
  }
  if (allowNotFound && response.status === 404) {
    return null;
  }
  if (!response.ok || !data) {
    throw new Error(`No se pudo consultar ${sourceLabel} (HTTP ${response.status}).`);
  }
  return data;
}

async function fetchAnimeScheduleCatalog({ baseUrl, headers, year, season }) {
  const catalog = [];
  let page = 1;
  let totalAmount = null;

  do {
    const url = new URL(`${baseUrl}/anime`);
    url.searchParams.set("years", String(year));
    url.searchParams.set("seasons", season.toLowerCase());
    url.searchParams.set("page", String(page));
    const data = await fetchJson(url, { headers, cache: "no-store" }, "AnimeSchedule");
    const rows = Array.isArray(data?.anime) ? data.anime : [];
    catalog.push(...rows);
    totalAmount = Number.isInteger(data?.totalAmount) ? data.totalAmount : catalog.length;
    page += 1;
  } while (catalog.length < totalAmount);

  return new Map(catalog.map((anime) => [String(anime?.route || "").trim(), anime]));
}

export async function fetchAnimeScheduleSeason({ year, season }) {
  const token = String(process.env.ANIME_SCHEDULE_API_TOKEN || "").trim();
  if (!token) {
    throw new Error("Falta configurar ANIME_SCHEDULE_API_TOKEN.");
  }

  const baseUrl = String(process.env.ANIME_SCHEDULE_API_BASE_URL || DEFAULT_ANIME_SCHEDULE_API_URL).replace(/\/+$/, "");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const weeks = getSeasonWeeks(year, season);
  const timetableRows = [];

  for (const item of weeks) {
    const url = new URL(`${baseUrl}/timetables/sub`);
    url.searchParams.set("year", String(item.year));
    url.searchParams.set("week", String(item.week));
    url.searchParams.set("tz", "UTC");
    const data = await fetchJson(url, {
      headers,
      cache: "no-store",
    }, "AnimeSchedule", { allowNotFound: true });
    if (!data) continue;
    const rows = Array.isArray(data) ? data : data?.timetable || data?.data || [];
    timetableRows.push(...rows);
  }

  const catalogByRoute = await fetchAnimeScheduleCatalog({ baseUrl, headers, year, season });
  const collected = timetableRows
    .map((item) => {
      const route = String(item?.route || item?.slug || item?.animeRoute || "").trim();
      const catalogAnime = catalogByRoute.get(route);
      return normalizeTimetableItem({
        ...item,
        aniListId: getAniListId(catalogAnime),
        websites: catalogAnime?.websites,
      });
    })
    .filter(Boolean);

  return Array.from(new Map(collected.map((item) => [`${item.aniListId}:${item.sourceKey}`, item])).values());
}

export async function fetchAniListMediaByIds(ids) {
  const uniqueIds = Array.from(new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  const results = [];

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const idBatch = uniqueIds.slice(index, index + 50);
    const query = `
      query SeasonalAnimeMetadata($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) { ${aniListMediaFields} }
        }
      }
    `;
    const data = await fetchJson(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { ids: idBatch } }),
      cache: "no-store",
    }, "AniList");

    if (data?.errors?.length) {
      throw new Error(data.errors[0]?.message || "AniList devolvió un error.");
    }
    results.push(...(data?.data?.Page?.media || []));
  }

  return new Map(results.map((media) => [media.id, {
    aniListId: media.id,
    titleRomaji: media.title?.romaji || media.title?.english || media.title?.native || `Anime #${media.id}`,
    titleEnglish: media.title?.english || null,
    titleNative: media.title?.native || null,
    description: cleanText(media.description) || null,
    imageUrl: media.coverImage?.extraLarge || media.coverImage?.large || null,
    format: media.format || null,
    episodes: media.episodes || null,
    status: media.status || null,
    aniListUrl: media.siteUrl || `https://anilist.co/anime/${media.id}`,
    trailerSite: media.trailer?.site || null,
    trailerId: media.trailer?.id || null,
    tags: normalizeTags(media.tags),
    isAdult: Boolean(media.isAdult),
    isDonghua: media.countryOfOrigin === "CN",
    sourceUpdatedAt: media.updatedAt ? new Date(media.updatedAt * 1000) : new Date(),
  }]));
}

export async function buildSeasonalAnimeImport({ year, season }) {
  const airings = await fetchAnimeScheduleSeason({ year, season });
  const metadata = await fetchAniListMediaByIds(airings.map((item) => item.aniListId));
  const grouped = new Map();

  for (const airing of airings) {
    const media = metadata.get(airing.aniListId);
    if (!media) continue;
    const current = grouped.get(airing.aniListId) || {
      ...media,
      animeScheduleRoute: airing.route,
      airings: [],
    };
    current.airings.push(airing);
    grouped.set(airing.aniListId, current);
  }

  return {
    year,
    season,
    animes: Array.from(grouped.values()),
    conflicts: airings.filter((item) => !metadata.has(item.aniListId)).map((item) => ({
      aniListId: item.aniListId,
      sourceKey: item.sourceKey,
    })),
  };
}
