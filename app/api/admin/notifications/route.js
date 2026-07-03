import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import {
  getAdminNotificationById,
  listAdminNotifications,
  saveAdminNotification,
  updateAdminNotificationState,
} from "@/lib/repositories/notificationRepository";
import {
  listPlatformPermissions,
  listPlatformUsers,
} from "@/lib/repositories/platformUserRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.notifications.view");
  if (authorization.response) return authorization.response;
  const params = new URL(request.url).searchParams;
  const result = await listAdminNotifications({
    search: params.get("search") || "", type: params.get("type") || "all", severity: params.get("severity") || "all", source: params.get("source") || "all",
    status: params.get("status") || "all", page: params.get("page") || 1, pageSize: params.get("pageSize") || 10,
    sort: params.get("sort") || "id", direction: params.get("direction") || "desc",
  });
  const [permissions, users] = await Promise.all([
    listPlatformPermissions(),
    listPlatformUsers(),
  ]);
  return NextResponse.json({
    success: true,
    ...result,
    targetOptions: {
      permissions: permissions.map((permission) => ({
        value: permission.code,
        label: permission.label || permission.code,
        group: permission.group || "",
      })),
      users: users.map((user) => ({
        value: String(user.id),
        label: `${user.alias || user.login} · @${user.login}`,
        helper: user.roleLabel || user.role || "",
        isActive: user.isActive !== false,
      })),
    },
  });
}

export async function POST(request) {
  const payload = await readJsonRequest(request);
  if (!payload) return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  const action = payload.action;
  const permission = action === "create" ? "admin.notifications.create"
    : ["delete", "restore"].includes(action) ? "admin.notifications.delete"
      : "admin.notifications.update";
  const authorization = await ensurePermissionAuthorized(request, permission);
  if (authorization.response) return authorization.response;
  try {
    const before = payload.id ? await getAdminNotificationById(payload.id) : null;
    const saved = ["create", "update"].includes(action)
      ? await saveAdminNotification(payload.notification, { actor: authorization.user })
      : await updateAdminNotificationState(payload.id, action);
    await createAuditLog({
      actor: authorization.user, action: action === "create" ? "create" : action,
      module: "admin.notifications", entityType: "PlatformNotification", entityId: saved.id,
      entityLabel: saved.title, summary: `${action === "create" ? "Creó" : action === "update" ? "Editó" : action === "delete" ? "Eliminó" : action === "restore" ? "Restauró" : action === "activate" ? "Activó" : "Desactivó"} notificación`,
      before, after: saved, request,
    });
    return NextResponse.json({ success: true, notification: saved });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo administrar la notificación." }, { status: 400 });
  }
}
