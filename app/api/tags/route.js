import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";
import { readTagSettings, writeTagSettings } from "@/lib/tagSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readTagSettings();
  return NextResponse.json({ success: true, ...settings });
}

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const payload = await request.json();
  const settings = await writeTagSettings({
    categories: payload?.categories,
    overrides: payload?.overrides,
  });

  return NextResponse.json({ success: true, ...settings });
}
