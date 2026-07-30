import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function AnimeTierListOpeningsRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
  ]);

  if (!can(accessUser, "anime.tierlist.openings.view")) {
    redirect(currentUser ? "/sin-acceso?from=/biblioteca-anime/tier-list/openings" : "/login?next=/biblioteca-anime/tier-list/openings");
  }

  return <HomePage activeView="animeTierListOpenings" isAdmin={isAdmin} currentUser={currentUser} accessPermissions={accessUser?.permissions || []} />;
}
