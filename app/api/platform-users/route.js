import { NextResponse } from "next/server";

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

  const payload = await request.json();

  try {
    if ((payload?.action === "create" || payload?.action === "update") && payload.user) {
      const requiredPermission = payload.action === "create" ? "users.create" : "users.update";
      const actionAuthorization = await ensurePermissionAuthorized(request, requiredPermission);
      if (actionAuthorization.response) {
        return actionAuthorization.response;
      }

      await upsertPlatformUser(payload.user, { actor: authorization.user });
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

      await deletePlatformUser(payload.id);
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

      await updatePlatformUserStatus(payload.id, payload.isActive);
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
