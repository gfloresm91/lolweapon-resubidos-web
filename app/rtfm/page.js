import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can, listPlatformPermissions, listPlatformRoles } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses } from "@/lib/repositories/liveRepository";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "RTFM | LOLWEAPON",
  description: "Información base del archivo de resubidos, fuentes comunitarias y enlaces principales.",
};

export default async function RtfmRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin, liveStatuses, platformRoles, platformPermissions] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
    getLiveStatuses(),
    listPlatformRoles({ includeInactive: true }),
    listPlatformPermissions(),
  ]);

  if (!can(accessUser, "rtfm.view")) {
    notFound();
  }

  return (
    <HomePage
      activeView="rtfm"
      initialLives={[]}
      initialLiveStatuses={liveStatuses}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={accessUser?.permissions || []}
      initialPlatformRoles={platformRoles}
      initialPlatformPermissions={platformPermissions}
    />
  );
}
