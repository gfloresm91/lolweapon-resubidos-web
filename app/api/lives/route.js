import { NextResponse } from "next/server";

import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  const [lives, statuses] = await Promise.all([
    readLives(),
    getLiveStatuses(),
  ]);

  return NextResponse.json(
    { lives, statuses },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20" } },
  );
}
