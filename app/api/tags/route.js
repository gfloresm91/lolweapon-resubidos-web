import { NextResponse } from "next/server";

import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { readTagSettings, writeTagSettings } from "@/lib/tagSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readTagSettings();
  return NextResponse.json({ success: true, ...settings });
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
