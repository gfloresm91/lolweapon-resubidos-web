import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { ensureRoleManagementAuthorized } from "@/lib/serverAuth";
import {
  listPlatformPermissions,
  listPlatformRoles,
  updatePlatformRoleStatus,
  upsertPlatformRole,
} from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensureRoleManagementAuthorized(request);
  if (authorization.response) {
    return authorization.response;
  }

  const [roles, permissions] = await Promise.all([
    listPlatformRoles({ includeInactive: true }),
    listPlatformPermissions(),
  ]);

  return NextResponse.json({ success: true, roles, permissions });
}

export async function POST(request) {
  const authorization = await ensureRoleManagementAuthorized(request);
  if (authorization.response) {
    return authorization.response;
  }

  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    if ((payload?.action === "create" || payload?.action === "update") && payload.role) {
      const before = payload.role?.id
        ? (await listPlatformRoles({ includeInactive: true })).find((role) => Number(role.id) === Number(payload.role.id)) || null
        : null;
      const savedRole = await upsertPlatformRole(payload.role, { actor: authorization.user });
      await createAuditLog({
        actor: authorization.user,
        action: payload.action === "create" ? "create" : "permission_change",
        module: "admin.roles",
        entityType: "PlatformRole",
        entityId: savedRole.id,
        entityLabel: savedRole.label || savedRole.code,
        summary: payload.action === "create" ? "Creó rol" : "Editó rol y permisos",
        before,
        after: savedRole,
        request,
      });
      const [roles, permissions] = await Promise.all([
        listPlatformRoles({ includeInactive: true }),
        listPlatformPermissions(),
      ]);

      return NextResponse.json({ success: true, roles, permissions });
    }

    if (payload?.action === "update-status" && payload.id) {
      const before = (await listPlatformRoles({ includeInactive: true })).find((role) => Number(role.id) === Number(payload.id)) || null;
      await updatePlatformRoleStatus(payload.id, payload.isActive, { actor: authorization.user });
      await createAuditLog({
        actor: authorization.user,
        action: payload.isActive ? "activate" : "deactivate",
        module: "admin.roles",
        entityType: "PlatformRole",
        entityId: payload.id,
        entityLabel: before?.label || before?.code || payload.id,
        summary: payload.isActive ? "Activó rol" : "Desactivó rol",
        before,
        after: { ...(before || {}), isActive: Boolean(payload.isActive) },
        request,
      });
      const [roles, permissions] = await Promise.all([
        listPlatformRoles({ includeInactive: true }),
        listPlatformPermissions(),
      ]);

      return NextResponse.json({ success: true, roles, permissions });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json(
    { success: false, error: "Acción no soportada" },
    { status: 400 },
  );
}
