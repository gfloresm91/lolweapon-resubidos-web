import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { can, listPlatformPermissions, listPlatformRoles } from "@/lib/repositories/platformUserRepository";
import { getAccessUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const accessUser = await getAccessUserFromToken(token);

  if (!can(accessUser, "rtfm.view")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [roles, permissions] = await Promise.all([
    listPlatformRoles({ includeInactive: true }),
    listPlatformPermissions(),
  ]);

  return NextResponse.json({ roles, permissions });
}
