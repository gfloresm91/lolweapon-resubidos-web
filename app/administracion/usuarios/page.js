import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUserFromToken, validateUserManagementSessionToken } from "@/lib/serverAuth";
import { listPlatformRoles, listPlatformUsers } from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

export default async function PlatformUsersAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, canManageUsers] = await Promise.all([
    getCurrentUserFromToken(token),
    validateUserManagementSessionToken(token),
  ]);

  if (!canManageUsers) {
    redirect("/login");
  }

  const [platformUsers, platformRoles] = await Promise.all([
    listPlatformUsers(),
    listPlatformRoles(),
  ]);

  return (
    <HomePage
      activeView="platformUsers"
      initialLives={[]}
      initialPlatformUsers={platformUsers}
      initialPlatformRoles={platformRoles}
      isAdmin={true}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
    />
  );
}
