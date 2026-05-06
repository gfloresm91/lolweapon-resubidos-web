import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";
import { deleteLive, getLiveStatuses, upsertLive, writeLives } from "@/lib/repositories/liveRepository";
import { normalizeLives, sortLives } from "@/lib/lives";

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const payload = await request.json();
  const action = payload?.action;

  if (action === "replace" && Array.isArray(payload.lives)) {
    const nextLives = sortLives(normalizeLives(payload.lives));
    await writeLives(nextLives);
    const statuses = await getLiveStatuses();
    return NextResponse.json({ success: true, lives: nextLives, statuses });
  }

  if (action === "upsert" && payload.live) {
    const [sortedLives, statuses] = await Promise.all([
      upsertLive(payload.live),
      getLiveStatuses(),
    ]);
    return NextResponse.json({ success: true, lives: sortedLives, statuses });
  }

  if (action === "delete" && payload.id) {
    const [nextLives, statuses] = await Promise.all([
      deleteLive(payload.id),
      getLiveStatuses(),
    ]);
    return NextResponse.json({ success: true, lives: nextLives, statuses });
  }

  return NextResponse.json(
    { success: false, error: "Accion no soportada" },
    { status: 400 },
  );
}
