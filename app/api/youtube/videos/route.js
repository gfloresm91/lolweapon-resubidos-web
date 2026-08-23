import { NextResponse } from "next/server";

import { fetchLatestYoutubeVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 60 * 60 * 1000;
const RESPONSE_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=900";
const globalForYoutube = globalThis;

if (!globalForYoutube.__lolweaponYoutubeVideos) {
  globalForYoutube.__lolweaponYoutubeVideos = {
    videos: [],
    updatedAt: 0,
    refreshPromise: null,
  };
}

const youtubeCache = globalForYoutube.__lolweaponYoutubeVideos;

function createResponse(videos, cacheStatus, error = null) {
  return NextResponse.json(
    { videos, ...(error ? { error } : {}) },
    {
      headers: {
        "Cache-Control": RESPONSE_CACHE_CONTROL,
        "Cloudflare-CDN-Cache-Control": RESPONSE_CACHE_CONTROL,
        "X-Youtube-Videos-Cache": cacheStatus,
      },
    },
  );
}

function refreshVideos() {
  if (!youtubeCache.refreshPromise) {
    youtubeCache.refreshPromise = fetchLatestYoutubeVideos(10)
      .then((videos) => {
        youtubeCache.videos = videos;
        youtubeCache.updatedAt = Date.now();
        return videos;
      })
      .finally(() => {
        youtubeCache.refreshPromise = null;
      });
  }

  return youtubeCache.refreshPromise;
}

export async function GET() {
  const cacheAge = Date.now() - youtubeCache.updatedAt;

  if (youtubeCache.updatedAt && cacheAge <= CACHE_TTL_MS) {
    return createResponse(youtubeCache.videos, "hit");
  }

  try {
    return createResponse(await refreshVideos(), "refresh");
  } catch (error) {
    if (youtubeCache.updatedAt && cacheAge <= STALE_TTL_MS) {
      return createResponse(youtubeCache.videos, "stale", error.message);
    }

    youtubeCache.updatedAt = Date.now();
    return createResponse([], "error", error.message);
  }
}
