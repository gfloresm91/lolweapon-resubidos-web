import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getSeasonalAnimeAdminData } from "@/lib/repositories/seasonalAnimeCalendarRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function PlatformSeasonalAnimeCalendarRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (!can(currentUser, "admin.anime.calendar.view")) redirect("/login");
  const initialAnimeCalendarAdmin = await getSeasonalAnimeAdminData();
  return <HomePage activeView="platformAnimeSeasonCalendar" initialAnimeCalendarAdmin={initialAnimeCalendarAdmin} isAdmin currentUser={currentUser} accessPermissions={currentUser?.permissions || []} />;
}
