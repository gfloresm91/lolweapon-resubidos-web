import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses } from "@/lib/repositories/liveRepository";
import { readSpaceDrum } from "@/lib/repositories/spaceDrumRepository";

export const dynamic = "force-dynamic";

export default async function SpaceDrumRoutePage() {
  if (process.env.NEXT_PUBLIC_ENABLE_SPACEDRUM !== "true") {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin, spacedrum, liveStatuses] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
    readSpaceDrum(),
    getLiveStatuses(),
  ]);

  if (!can(accessUser, "spacedrum.view")) {
    notFound();
  }

  return (
    <HomePage
      activeView="spacedrum"
      initialLives={[]}
      initialLiveStatuses={liveStatuses}
      initialSpaceDrum={spacedrum}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={accessUser?.permissions || []}
    />
  );
}
