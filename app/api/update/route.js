import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { createPlatformNotification } from "@/lib/repositories/notificationRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { deleteLive, getLiveStatuses, readLives, updateLiveStatus, upsertLive, writeLives } from "@/lib/repositories/liveRepository";
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
    const before = await readLives();
    const nextLives = sortLives(normalizeLives(payload.lives));
    await writeLives(nextLives);
    await createAuditLog({
      actor: authorization.user,
      action: "replace",
      module: "admin.tracker",
      entityType: "Live",
      entityId: "bulk",
      entityLabel: "Carga masiva",
      summary: "Reemplazó registros del rastreador",
      before: { count: before.length },
      after: { count: nextLives.length },
      request,
    });
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

    const before = payload.live?.id ? (await readLives()).find((live) => live.id === payload.live.id) || null : null;
    const [sortedLives, statuses] = await Promise.all([
      upsertLive(validation.data),
      getLiveStatuses(),
    ]);
    const savedLive = sortedLives.find((live) => live.id === validation.data.id) || validation.data;
    await createAuditLog({
      actor: authorization.user,
      action: before ? "update" : "create",
      module: "admin.tracker",
      entityType: "Live",
      entityId: savedLive.id,
      entityLabel: savedLive.title,
      summary: before ? "Editó directo" : "Creó directo",
      before,
      after: savedLive,
      request,
    });
    if (!before) {
      await createPlatformNotification({
        type: "activity",
        severity: "success",
        title: "Nuevo directo en el rastreador",
        body: savedLive.title,
        href: `/rastreador/${encodeURIComponent(savedLive.id)}`,
        icon: "CirclePlay",
        audience: "authenticated",
        actor: authorization.user,
        metadata: { liveId: savedLive.id },
      });
    }
    return NextResponse.json({ success: true, lives: sortedLives, statuses });
  }

  if (action === "delete" && payload.id) {
    const before = (await readLives()).find((live) => live.id === payload.id) || null;
    const [nextLives, statuses] = await Promise.all([
      deleteLive(payload.id),
      getLiveStatuses(),
    ]);
    await createAuditLog({
      actor: authorization.user,
      action: "delete",
      module: "admin.tracker",
      entityType: "Live",
      entityId: payload.id,
      entityLabel: before?.title || payload.id,
      summary: "Eliminó directo",
      before,
      after: null,
      request,
    });
    return NextResponse.json({ success: true, lives: nextLives, statuses });
  }

  if (action === "status" && payload.id && payload.status) {
    const before = (await readLives()).find((live) => live.id === payload.id) || null;
    const [nextLives, statuses] = await Promise.all([
      updateLiveStatus(payload.id, payload.status),
      getLiveStatuses(),
    ]);
    const after = nextLives.find((live) => live.id === payload.id) || { id: payload.id, status: payload.status };
    await createAuditLog({
      actor: authorization.user,
      action: "status_change",
      module: "admin.tracker",
      entityType: "Live",
      entityId: payload.id,
      entityLabel: before?.title || after?.title || payload.id,
      summary: "Cambió estado de directo",
      before,
      after,
      request,
    });
    return NextResponse.json({ success: true, lives: nextLives, statuses });
  }

  return NextResponse.json(
    { success: false, error: "Acción no soportada" },
    { status: 400 },
  );
}
