import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { withPublicAccessPermissions } from "@/lib/publicAccessPolicy";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { getLiveStatuses } from "@/lib/repositories/liveRepository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Novedades | LOLWEAPON",
  description: "Guía de novedades, beneficios por tipo de usuario y tutoriales rápidos de la plataforma LOLWEAPON.",
};

export default async function NewsRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, isAdmin, liveStatuses] = await Promise.all([
    getCurrentUserFromToken(token),
    validateAdminSessionToken(token),
    getLiveStatuses(),
  ]);

  return (
    <HomePage
      activeView="news"
      initialLives={[]}
      initialLiveStatuses={liveStatuses}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={withPublicAccessPermissions(currentUser?.permissions)}
    />
  );
}
