import { fetchAniListMediaByIds } from "./animeCalendarSources.js";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

async function fetchJson(url, options, sourceLabel) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => null);

  if (response.status === 429) {
    throw new Error(`${sourceLabel} está limitando las consultas. Intenta nuevamente más tarde.`);
  }
  if (!response.ok || !data) {
    throw new Error(`No se pudo consultar ${sourceLabel} (HTTP ${response.status}).`);
  }
  return data;
}

async function fetchAniListSeasonalIds({ year, season }) {
  const ids = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const query = `
      query SeasonalAnimeIds($season: MediaSeason, $seasonYear: Int, $page: Int) {
        Page(page: $page, perPage: 50) {
          pageInfo { hasNextPage }
          media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
            id
          }
        }
      }
    `;
    const data = await fetchJson(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { season, seasonYear: year, page } }),
      cache: "no-store",
    }, "AniList");

    if (data?.errors?.length) {
      throw new Error(data.errors[0]?.message || "AniList devolvió un error.");
    }

    const mediaPage = data?.data?.Page;
    ids.push(...(mediaPage?.media || []).map((item) => item.id));
    hasNextPage = Boolean(mediaPage?.pageInfo?.hasNextPage);
    page += 1;
  }

  return ids;
}

export async function buildAnimeTierListEntryImport({ year, season }) {
  const ids = await fetchAniListSeasonalIds({ year, season });
  const metadata = await fetchAniListMediaByIds(ids);

  const entries = ids
    .map((id) => metadata.get(id))
    .filter(Boolean)
    .map((media) => ({
      aniListId: media.aniListId,
      titleRomaji: media.titleRomaji,
      titleEnglish: media.titleEnglish,
      titleNative: media.titleNative,
      imageUrl: media.imageUrl,
      format: media.format,
      episodes: media.episodes,
      status: media.status,
      aniListUrl: media.aniListUrl,
      isAdult: media.isAdult,
      isDonghua: media.isDonghua,
      sourceUpdatedAt: media.sourceUpdatedAt,
    }));

  return { year, season, entries };
}

export async function fetchAniListMediaById(aniListId) {
  const metadata = await fetchAniListMediaByIds([aniListId]);
  return metadata.get(Number(aniListId)) || null;
}
