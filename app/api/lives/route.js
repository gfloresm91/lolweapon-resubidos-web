import { NextResponse } from "next/server";

import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  const [lives, statuses] = await Promise.all([
    readLives(),
    getLiveStatuses(),
  ]);

  return NextResponse.json({ lives, statuses });
}
