import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUserFromToken, validateRoleManagementSessionToken } from "@/lib/serverAuth";
import { listPlatformPermissions, listPlatformRoles } from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

export default async function PlatformRolesAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, canManageRoles] = await Promise.all([
    getCurrentUserFromToken(token),
    validateRoleManagementSessionToken(token),
  ]);

  if (!canManageRoles) {
    redirect("/login");
  }

  const [platformRoles, platformPermissions] = await Promise.all([
    listPlatformRoles({ includeInactive: true }),
    listPlatformPermissions(),
  ]);

  return (
    <HomePage
      activeView="platformRoles"
      initialLives={[]}
      initialPlatformRoles={platformRoles}
      initialPlatformPermissions={platformPermissions}
      isAdmin={true}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
    />
  );
}
