import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can, listPlatformPermissions, listPlatformRoles, listPlatformUsers } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";
import { getAnimeActivityMapForUser } from "@/lib/repositories/animeActivityRepository";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin, lives, liveStatuses] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
    readLives(),
    getLiveStatuses(),
  ]);

  if (!can(accessUser, "home.view")) {
    redirect("/login");
  }

  const userId = currentUser?.id;
  const canViewAdmin = can(accessUser, "admin.tracker.view") || can(accessUser, "admin.tags.view") || can(accessUser, "users.read") || can(accessUser, "roles.read");

  const [animeActivity, platformUsers, platformRoles, platformPermissions] = await Promise.all([
    userId ? getAnimeActivityMapForUser(userId) : Promise.resolve({}),
    canViewAdmin ? listPlatformUsers() : Promise.resolve([]),
    canViewAdmin ? listPlatformRoles() : Promise.resolve([]),
    canViewAdmin ? listPlatformPermissions() : Promise.resolve([]),
  ]);

  const twitchLogin = process.env.TWITCH_BROADCASTER_LOGIN || "kalathraslolweapon";
  const youtubeChannelUrl =
    process.env.YOUTUBE_CHANNEL_URL ||
    (process.env.YOUTUBE_CHANNEL_ID
      ? `https://www.youtube.com/channel/${process.env.YOUTUBE_CHANNEL_ID}`
      : "https://www.youtube.com/@Lolweapon");

  return (
    <HomePage
      activeView="home"
      initialLives={lives}
      initialLiveStatuses={liveStatuses}
      twitchLogin={twitchLogin}
      youtubeChannelUrl={youtubeChannelUrl}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={accessUser?.permissions || []}
      initialAnimeActivity={animeActivity}
      initialPlatformUsers={platformUsers}
      initialPlatformRoles={platformRoles}
      initialPlatformPermissions={platformPermissions}
    />
  );
}
