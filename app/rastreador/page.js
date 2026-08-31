import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { withPublicAccessPermissions } from "@/lib/publicAccessPolicy";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";
import { getLiveActivityMapForUser } from "@/lib/repositories/liveActivityRepository";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, isAdmin, lives, liveStatuses] = await Promise.all([
    getCurrentUserFromToken(token),
    validateAdminSessionToken(token),
    readLives(),
    getLiveStatuses(),
  ]);

  const initialLiveActivity = currentUser?.id ? await getLiveActivityMapForUser(currentUser.id) : {};

  return (
    <HomePage
      activeView="tracker"
      initialLives={lives}
      initialLivesCoverage="complete"
      initialLiveStatuses={liveStatuses}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={withPublicAccessPermissions(currentUser?.permissions)}
      initialLiveActivity={initialLiveActivity}
    />
  );
}
