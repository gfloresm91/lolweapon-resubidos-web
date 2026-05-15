import { NextResponse } from "next/server";

import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { readLives } from "@/lib/repositories/liveRepository";
import { readTagSettings, writeTagSettings } from "@/lib/tagSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [settings, lives] = await Promise.all([
    readTagSettings(),
    readLives(),
  ]);
  const tagCounts = {};

  for (const live of lives) {
    for (const tag of live.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return NextResponse.json({ success: true, ...settings, tags: Object.keys(tagCounts).sort(), tagCounts });
}

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "tracker.update");
  if (authorization.response) {
    return authorization.response;
  }

  const payload = await request.json();
  const settings = await writeTagSettings({
    categories: payload?.categories,
    overrides: payload?.overrides,
  });

  return NextResponse.json({ success: true, ...settings });
}
