import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
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
      await upsertPlatformRole(payload.role, { actor: authorization.user });
      const [roles, permissions] = await Promise.all([
        listPlatformRoles({ includeInactive: true }),
        listPlatformPermissions(),
      ]);

      return NextResponse.json({ success: true, roles, permissions });
    }

    if (payload?.action === "update-status" && payload.id) {
      await updatePlatformRoleStatus(payload.id, payload.isActive, { actor: authorization.user });
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
