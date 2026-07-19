import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";
import { canAny } from "@/lib/repositories/platformUserRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const TRACKER_MANAGEMENT_PERMISSIONS = [
  "tracker.create",
  "tracker.update",
  "tracker.delete",
  "tracker.export",
  "tracker.import",
];
const TRACKER_SCREEN_PERMISSION = "admin.tracker.view";

export default async function PlatformTrackerAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (
    !canAny(currentUser, [TRACKER_SCREEN_PERMISSION])
    || !canAny(currentUser, TRACKER_MANAGEMENT_PERMISSIONS)
  ) {
    redirect("/login");
  }

  const [lives, liveStatuses] = await Promise.all([
    readLives(),
    getLiveStatuses(),
  ]);
  const twitchLogin = process.env.TWITCH_BROADCASTER_LOGIN || "kalathraslolweapon";

  return (
    <HomePage
      activeView="platformTracker"
      initialLives={lives}
      initialLiveStatuses={liveStatuses}
      isAdmin={true}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
      twitchLogin={twitchLogin}
    />
  );
}
