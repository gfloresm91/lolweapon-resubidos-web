import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { listPlatformPermissions, listPlatformRoles } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses } from "@/lib/repositories/liveRepository";
import {
  withPublicAccessPermissions,
  withPublicPermissionDefinitions,
  withPublicVisitorRole,
} from "@/lib/publicAccessPolicy";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "RTFM | LOLWEAPON",
  description: "Información base del archivo de resubidos, fuentes comunitarias y enlaces principales.",
};

export default async function RtfmRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  const [isAdmin, liveStatuses, storedRoles, storedPermissions] = await Promise.all([
    validateAdminSessionToken(token),
    getLiveStatuses(),
    listPlatformRoles({ includeInactive: true }),
    listPlatformPermissions(),
  ]);
  const platformRoles = withPublicVisitorRole(storedRoles);
  const platformPermissions = withPublicPermissionDefinitions(storedPermissions);

  return (
    <HomePage
      activeView="rtfm"
      initialLives={[]}
      initialLiveStatuses={liveStatuses}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={withPublicAccessPermissions(currentUser?.permissions)}
      initialPlatformRoles={platformRoles}
      initialPlatformPermissions={platformPermissions}
    />
  );
}
