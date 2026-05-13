import { NextResponse } from "next/server";

import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { deleteLive, getLiveStatuses, upsertLive, writeLives } from "@/lib/repositories/liveRepository";
import { normalizeLives, sortLives } from "@/lib/lives";

export async function POST(request) {
  const payload = await request.json();
  const action = payload?.action;
  const permissionByAction = {
    replace: "tracker.update",
    upsert: payload?.live?.id ? "tracker.update" : "tracker.create",
    delete: "tracker.delete",
  };
  const requiredPermission = permissionByAction[action];

  if (!requiredPermission) {
    return NextResponse.json(
      { success: false, error: "Acción no soportada" },
      { status: 400 },
    );
  }

  const authorization = await ensurePermissionAuthorized(request, requiredPermission);
  if (authorization.response) {
    return authorization.response;
  }

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
    { success: false, error: "Acción no soportada" },
    { status: 400 },
  );
}
