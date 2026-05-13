import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin, lives, liveStatuses] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
    readLives(),
    getLiveStatuses(),
  ]);

  if (!can(accessUser, "tracker.view")) {
    redirect("/login");
  }

  return (
    <HomePage
      activeView="tracker"
      initialLives={lives}
      initialLiveStatuses={liveStatuses}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={accessUser?.permissions || []}
    />
  );
}
