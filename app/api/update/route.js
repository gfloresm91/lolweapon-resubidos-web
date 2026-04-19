import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";
import { readLives, writeLives } from "@/lib/data";
import { normalizeLive, normalizeLives, sortLives } from "@/lib/lives";

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const payload = await request.json();
  const action = payload?.action;
  const existingLives = await readLives();

  if (action === "replace" && Array.isArray(payload.lives)) {
    const nextLives = sortLives(normalizeLives(payload.lives));
    await writeLives(nextLives);
    return NextResponse.json({ success: true, lives: nextLives });
  }

  if (action === "upsert" && payload.live) {
    const nextLives = [...existingLives];
    const normalizedLive = normalizeLive(payload.live);
    const index = nextLives.findIndex((live) => live.id === normalizedLive.id);

    if (index >= 0) {
      nextLives[index] = normalizedLive;
    } else {
      nextLives.unshift(normalizedLive);
    }

    const sortedLives = sortLives(nextLives);
    await writeLives(sortedLives);
    return NextResponse.json({ success: true, lives: sortedLives });
  }

  if (action === "delete" && payload.id) {
    const nextLives = existingLives.filter((live) => live.id !== payload.id);
    await writeLives(nextLives);
    return NextResponse.json({ success: true, lives: nextLives });
  }

  return NextResponse.json(
    { success: false, error: "Accion no soportada" },
    { status: 400 },
  );
}
