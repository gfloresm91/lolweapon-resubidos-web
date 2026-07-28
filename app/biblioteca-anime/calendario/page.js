import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getSeasonalAnimeCalendar } from "@/lib/repositories/seasonalAnimeCalendarRepository";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function SeasonalAnimeCalendarRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
  ]);

  if (!can(accessUser, "anime.calendar.view")) {
    redirect(currentUser ? "/sin-acceso?from=/biblioteca-anime/calendario" : "/login?next=/biblioteca-anime/calendario");
  }

  const initialAnimeCalendar = await getSeasonalAnimeCalendar({ userId: currentUser?.id || null });
  return <HomePage activeView="animeSeasonCalendar" initialAnimeCalendar={initialAnimeCalendar} isAdmin={isAdmin} currentUser={currentUser} accessPermissions={accessUser?.permissions || []} />;
}
