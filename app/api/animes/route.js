import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";
import { readAnimes, writeAnimes } from "@/lib/animeData";
import { normalizeAnime, normalizeAnimes, sortAnimes } from "@/lib/animes";

export const dynamic = "force-dynamic";

export async function GET() {
  const animes = await readAnimes();
  return NextResponse.json({ animes });
}

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const payload = await request.json();
  const action = payload?.action;
  const existingAnimes = await readAnimes();

  if (action === "replace" && Array.isArray(payload.animes)) {
    const nextAnimes = sortAnimes(normalizeAnimes(payload.animes));
    await writeAnimes(nextAnimes);
    return NextResponse.json({ success: true, animes: nextAnimes });
  }

  if (action === "upsert" && payload.anime) {
    const normalizedAnime = normalizeAnime(payload.anime);
    const nextAnimes = [...existingAnimes];
    const index = nextAnimes.findIndex((anime) => anime.id === normalizedAnime.id);

    if (index >= 0) {
      nextAnimes[index] = normalizedAnime;
    } else {
      nextAnimes.unshift(normalizedAnime);
    }

    const sortedAnimes = sortAnimes(nextAnimes);
    await writeAnimes(sortedAnimes);
    return NextResponse.json({ success: true, animes: sortedAnimes });
  }

  if (action === "delete" && payload.id) {
    const nextAnimes = existingAnimes.filter((anime) => anime.id !== payload.id);
    await writeAnimes(nextAnimes);
    return NextResponse.json({ success: true, animes: nextAnimes });
  }

  return NextResponse.json(
    { success: false, error: "Accion no soportada" },
    { status: 400 },
  );
}

