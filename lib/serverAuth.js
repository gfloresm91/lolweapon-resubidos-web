import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import {
  can,
  canAny,
  getPublicAccessUser,
  getPlatformUserBySessionToken,
  userCanAdmin,
  userCanManagePlatformRoles,
  userCanManagePlatformUsers,
} from "@/lib/repositories/platformUserRepository";

export async function getCurrentUserFromToken(token) {
  if (!token) {
    return null;
  }

  try {
    const user = await getPlatformUserBySessionToken(token);
    return user ? { ...user, authProvider: "platform" } : null;
  } catch {
    return null;
  }
}

export async function getAccessUserFromToken(token) {
  return (await getCurrentUserFromToken(token)) || getPublicAccessUser();
}

export async function validatePermissionSessionToken(token, permissionCode) {
  const user = await getAccessUserFromToken(token);
  return can(user, permissionCode);
}

export async function validateAnyPermissionSessionToken(token, permissionCodes = []) {
  const user = await getAccessUserFromToken(token);
  return canAny(user, permissionCodes);
}

export async function validateAdminSessionToken(token) {
  const user = await getCurrentUserFromToken(token);
  return userCanAdmin(user);
}

export async function validateUserManagementSessionToken(token) {
  const user = await getCurrentUserFromToken(token);
  return userCanManagePlatformUsers(user);
}

export async function validateRoleManagementSessionToken(token) {
  const user = await getCurrentUserFromToken(token);
  return userCanManagePlatformRoles(user);
}

export async function ensureAuthorized(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!(await validateAdminSessionToken(token))) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  return null;
}

export async function ensurePermissionAuthorized(request, permissionCode) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  const user = currentUser || await getPublicAccessUser();

  if (!can(user, permissionCode)) {
    return {
      response: NextResponse.json(
        { success: false, error: currentUser ? "Permiso insuficiente" : "No autorizado" },
        { status: currentUser ? 403 : 401 },
      ),
      user: null,
    };
  }

  return { response: null, user };
}

export async function ensureAnyPermissionAuthorized(request, permissionCodes = []) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  const user = currentUser || await getPublicAccessUser();

  if (!canAny(user, permissionCodes)) {
    return {
      response: NextResponse.json(
        { success: false, error: currentUser ? "Permiso insuficiente" : "No autorizado" },
        { status: currentUser ? 403 : 401 },
      ),
      user: null,
    };
  }

  return { response: null, user };
}

export async function ensureUserManagementAuthorized(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);

  if (!userCanManagePlatformUsers(user)) {
    return {
      response: NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 }),
      user: null,
    };
  }

  return { response: null, user };
}

export async function ensureRoleManagementAuthorized(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);

  if (!userCanManagePlatformRoles(user)) {
    return {
      response: NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 }),
      user: null,
    };
  }

  return { response: null, user };
}
