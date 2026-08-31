import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";
import { getLiveActivityMapForUser } from "@/lib/repositories/liveActivityRepository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calendario de directos | LOLWEAPON",
  description: "Calendario historico de directos archivados de LOLWEAPON.",
};

export default async function TrackerCalendarPageRoute() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, isAdmin, lives, liveStatuses] = await Promise.all([
    getCurrentUserFromToken(token),
    validateAdminSessionToken(token),
    readLives(),
    getLiveStatuses(),
  ]);

  if (!can(currentUser, "tracker.calendar.view")) {
    redirect("/login");
  }

  const initialLiveActivity = currentUser?.id ? await getLiveActivityMapForUser(currentUser.id) : {};

  return (
    <HomePage
      activeView="trackerCalendar"
      initialLives={lives}
      initialLivesCoverage="complete"
      initialLiveStatuses={liveStatuses}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
      initialLiveActivity={initialLiveActivity}
    />
  );
}
