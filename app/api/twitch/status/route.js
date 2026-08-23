import { NextResponse } from "next/server";

import { getCachedTwitchStatus } from "@/lib/twitchStatus";

export const dynamic = "force-dynamic";

const RESPONSE_CACHE_CONTROL = "public, max-age=10, s-maxage=15, stale-while-revalidate=45";

function createResponse(status, cacheStatus) {
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": RESPONSE_CACHE_CONTROL,
      "Cloudflare-CDN-Cache-Control": RESPONSE_CACHE_CONTROL,
      "X-Twitch-Status-Cache": cacheStatus,
    },
  });
}

export async function GET() {
  const { status, cacheStatus, error } = await getCachedTwitchStatus();
  if (error && cacheStatus === "error") {
    console.error("> Twitch status refresh failed:", error);
  }
  return createResponse(status, cacheStatus);
}
