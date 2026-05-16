import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { deleteLive, getLiveStatuses, updateLiveStatus, upsertLive, writeLives } from "@/lib/repositories/liveRepository";
import { normalizeLives, sortLives } from "@/lib/lives";
import { getTrackerValidationMessage, trackerLivePayloadSchema } from "@/lib/trackerValidation";

export async function POST(request) {
  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const action = payload?.action;
  const permissionByAction = {
    replace: "tracker.update",
    create: "tracker.create",
    upsert: payload?.live?.id ? "tracker.update" : "tracker.create",
    status: "tracker.update",
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

  if ((action === "upsert" || action === "create") && payload.live) {
    const validation = trackerLivePayloadSchema.safeParse(payload.live);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: getTrackerValidationMessage(validation.error) },
        { status: 400 },
      );
    }

    const [sortedLives, statuses] = await Promise.all([
      upsertLive(validation.data),
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

  if (action === "status" && payload.id && payload.status) {
    const [nextLives, statuses] = await Promise.all([
      updateLiveStatus(payload.id, payload.status),
      getLiveStatuses(),
    ]);
    return NextResponse.json({ success: true, lives: nextLives, statuses });
  }

  return NextResponse.json(
    { success: false, error: "Acción no soportada" },
    { status: 400 },
  );
}
