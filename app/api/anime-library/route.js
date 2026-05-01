import { NextResponse } from "next/server";

import { ensureAuthorized, SESSION_COOKIE, validateSessionToken } from "@/lib/auth";
import { buildAnimeLibrary, hideAnimeMetadataEntry, updateAnimeMetadataEntry } from "@/lib/animeLibrary";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const includeHidden = validateSessionToken(token);
  const animes = await buildAnimeLibrary({ includeHidden });
  return NextResponse.json({ animes });
}

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const payload = await request.json();

  if ((payload?.action === "update" || payload?.action === "upsert") && payload.anime) {
    await updateAnimeMetadataEntry(payload.key, payload.anime);
    const animes = await buildAnimeLibrary({ includeHidden: true });
    return NextResponse.json({ success: true, animes });
  }

  if (payload?.action === "delete" && payload.key) {
    await hideAnimeMetadataEntry(payload.key);
    const animes = await buildAnimeLibrary({ includeHidden: true });
    return NextResponse.json({ success: true, animes });
  }

  return NextResponse.json(
    { success: false, error: "Accion no soportada" },
    { status: 400 },
  );
}
