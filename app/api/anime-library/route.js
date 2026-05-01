import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";
import { buildAnimeLibrary, updateAnimeMetadataEntry } from "@/lib/animeLibrary";

export const dynamic = "force-dynamic";

export async function GET() {
  const animes = await buildAnimeLibrary();
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
    const animes = await buildAnimeLibrary();
    return NextResponse.json({ success: true, animes });
  }

  return NextResponse.json(
    { success: false, error: "Accion no soportada" },
    { status: 400 },
  );
}
