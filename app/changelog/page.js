import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getLiveStatuses } from "@/lib/repositories/liveRepository";
import { withPublicAccessPermissions } from "@/lib/publicAccessPolicy";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Historial de cambios | LOLWEAPON",
  description: "Historial de versiones, novedades, mejoras y correcciones de la plataforma LOLWEAPON.",
};

export default async function ChangelogRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, isAdmin, liveStatuses] = await Promise.all([
    getCurrentUserFromToken(token),
    validateAdminSessionToken(token),
    getLiveStatuses(),
  ]);

  return (
    <HomePage
      activeView="changelog"
      initialLives={[]}
      initialLiveStatuses={liveStatuses}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={withPublicAccessPermissions(currentUser?.permissions)}
    />
  );
}
