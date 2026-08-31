import { NextResponse } from "next/server";

import { listPlatformPermissions, listPlatformRoles } from "@/lib/repositories/platformUserRepository";
import {
  withPublicPermissionDefinitions,
  withPublicVisitorRole,
} from "@/lib/publicAccessPolicy";

export const dynamic = "force-dynamic";

export async function GET() {
  const [roles, permissions] = await Promise.all([
    listPlatformRoles({ includeInactive: true }),
    listPlatformPermissions(),
  ]);

  return NextResponse.json({
    roles: withPublicVisitorRole(roles),
    permissions: withPublicPermissionDefinitions(permissions),
  });
}
