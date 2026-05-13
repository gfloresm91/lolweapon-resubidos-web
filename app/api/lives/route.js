import { NextResponse } from "next/server";

import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "tracker.view");
  if (authorization.response) {
    return authorization.response;
  }

  const [lives, statuses] = await Promise.all([
    readLives(),
    getLiveStatuses(),
  ]);

  return NextResponse.json({ lives, statuses });
}
