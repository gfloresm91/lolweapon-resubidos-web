import { NextResponse } from "next/server";

import { getHomePresenceCount } from "@/lib/pagePresence";
import { getStreamAudienceDashboard } from "@/lib/repositories/streamAudienceRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.audience.view");
  if (authorization.response) return authorization.response;

  const params = new URL(request.url).searchParams;
  const result = await getStreamAudienceDashboard({
    sessionId: params.get("sessionId"),
    limit: params.get("limit") || 10,
  });

  return NextResponse.json({
    success: true,
    ...result,
    currentCount: getHomePresenceCount(),
    generatedAt: new Date().toISOString(),
  });
}
