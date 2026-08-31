import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses } from "@/lib/repositories/liveRepository";
import {
  getSpaceDrumProgressForUser,
  readSpaceDrumLibrary,
} from "@/lib/repositories/spaceDrumRepository";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "SpaceDrum | LOLWEAPON",
  description: "Lee SpaceDrum, manga oficial disponible por ciclos en español e inglés.",
  openGraph: {
    title: "SpaceDrum | LOLWEAPON",
    description: "Lector bilingüe de SpaceDrum con capítulos disponibles en español e inglés.",
    images: ["https://spacedrum-worker.lolweapons.workers.dev/assets/background.jpg"],
  },
};

export default async function SpaceDrumRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, isAdmin, spacedrum, liveStatuses] = await Promise.all([
    getCurrentUserFromToken(token),
    validateAdminSessionToken(token),
    readSpaceDrumLibrary(),
    getLiveStatuses(),
  ]);
  const spaceDrumProgress = currentUser?.id ? await getSpaceDrumProgressForUser(currentUser.id) : {};

  if (!can(currentUser, "spacedrum.view")) {
    if (!currentUser?.id) {
      redirect("/login?next=/spacedrum");
    }

    redirect("/sin-acceso?from=/spacedrum");
  }

  return (
    <HomePage
      activeView="spacedrum"
      initialLives={[]}
      initialLiveStatuses={liveStatuses}
      initialSpaceDrum={spacedrum}
      initialSpaceDrumProgress={spaceDrumProgress}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
    />
  );
}
