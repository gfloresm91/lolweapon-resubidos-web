import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { ensurePermissionAuthorized, ensureUserManagementAuthorized } from "@/lib/serverAuth";
import {
  deletePlatformUser,
  listPlatformRoles,
  listPlatformUsers,
  updatePlatformUserStatus,
  upsertPlatformUser,
} from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensureUserManagementAuthorized(request);
  if (authorization.response) {
    return authorization.response;
  }

  const users = await listPlatformUsers();
  const roles = await listPlatformRoles();
  return NextResponse.json({ success: true, users, roles });
}

export async function POST(request) {
  const authorization = await ensureUserManagementAuthorized(request);
  if (authorization.response) {
    return authorization.response;
  }

  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    if ((payload?.action === "create" || payload?.action === "update") && payload.user) {
      const requiredPermission = payload.action === "create" ? "users.create" : "users.update";
      const actionAuthorization = await ensurePermissionAuthorized(request, requiredPermission);
      if (actionAuthorization.response) {
        return actionAuthorization.response;
      }

      const before = payload.user?.id
        ? (await listPlatformUsers()).find((user) => Number(user.id) === Number(payload.user.id)) || null
        : null;
      const savedUser = await upsertPlatformUser(payload.user, { actor: authorization.user });
      await createAuditLog({
        actor: authorization.user,
        action: payload.action,
        module: "admin.users",
        entityType: "PlatformUser",
        entityId: savedUser.id,
        entityLabel: savedUser.login || savedUser.alias,
        summary: payload.action === "create" ? "Creó usuario" : "Editó usuario",
        before,
        after: savedUser,
        request,
      });
      return NextResponse.json({
        success: true,
        users: await listPlatformUsers(),
        roles: await listPlatformRoles(),
      });
    }

    if (payload?.action === "delete" && payload.id) {
      const actionAuthorization = await ensurePermissionAuthorized(request, "users.delete");
      if (actionAuthorization.response) {
        return actionAuthorization.response;
      }

      const before = (await listPlatformUsers()).find((user) => Number(user.id) === Number(payload.id)) || null;
      await deletePlatformUser(payload.id);
      await createAuditLog({
        actor: authorization.user,
        action: "soft_delete",
        module: "admin.users",
        entityType: "PlatformUser",
        entityId: payload.id,
        entityLabel: before?.login || before?.alias || payload.id,
        summary: "Eliminó usuario",
        before,
        after: { deletedAt: new Date().toISOString(), isActive: false },
        request,
      });
      return NextResponse.json({
        success: true,
        users: await listPlatformUsers(),
        roles: await listPlatformRoles(),
      });
    }

    if (payload?.action === "update-status" && payload.id) {
      const actionAuthorization = await ensurePermissionAuthorized(request, "users.update");
      if (actionAuthorization.response) {
        return actionAuthorization.response;
      }

      const before = (await listPlatformUsers()).find((user) => Number(user.id) === Number(payload.id)) || null;
      await updatePlatformUserStatus(payload.id, payload.isActive);
      await createAuditLog({
        actor: authorization.user,
        action: payload.isActive ? "activate" : "deactivate",
        module: "admin.users",
        entityType: "PlatformUser",
        entityId: payload.id,
        entityLabel: before?.login || before?.alias || payload.id,
        summary: payload.isActive ? "Activó usuario" : "Desactivó usuario",
        before,
        after: { ...(before || {}), isActive: Boolean(payload.isActive) },
        request,
      });
      return NextResponse.json({
        success: true,
        users: await listPlatformUsers(),
        roles: await listPlatformRoles(),
      });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json(
    { success: false, error: "Acción no soportada" },
    { status: 400 },
  );
}
