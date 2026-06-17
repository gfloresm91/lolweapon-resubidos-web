import { NextResponse } from "next/server";

import { ensureAnyPermissionAuthorized } from "@/lib/serverAuth";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensureAnyPermissionAuthorized(request, ["tracker.view", "tracker.calendar.view"]);
  if (authorization.response) {
    return authorization.response;
  }

  const [lives, statuses] = await Promise.all([
    readLives(),
    getLiveStatuses(),
  ]);

  return NextResponse.json({ lives, statuses });
}
