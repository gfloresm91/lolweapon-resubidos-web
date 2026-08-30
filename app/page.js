import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { withPublicAccessPermissions } from "@/lib/publicAccessPolicy";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can, listPlatformPermissions, listPlatformRoles, listPlatformUsers } from "@/lib/repositories/platformUserRepository";
import { readRecentLives } from "@/lib/repositories/liveRepository";
import { getAnimeActivityMapForUser } from "@/lib/repositories/animeActivityRepository";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, isAdmin, lives] = await Promise.all([
    getCurrentUserFromToken(token),
    validateAdminSessionToken(token),
    readRecentLives({ limit: 10 }),
  ]);

  const userId = currentUser?.id;
  const canViewAdmin = can(currentUser, "admin.tracker.view") || can(currentUser, "admin.tags.view") || can(currentUser, "users.read") || can(currentUser, "roles.read");

  const [animeActivity, platformUsers, platformRoles, platformPermissions] = await Promise.all([
    userId ? getAnimeActivityMapForUser(userId) : Promise.resolve({}),
    canViewAdmin ? listPlatformUsers() : Promise.resolve([]),
    canViewAdmin ? listPlatformRoles() : Promise.resolve([]),
    canViewAdmin ? listPlatformPermissions() : Promise.resolve([]),
  ]);

  const twitchLogin = process.env.NEXT_PUBLIC_TWITCH_EMBED_LOGIN
    || process.env.TWITCH_BROADCASTER_LOGIN
    || "kalathraslolweapon";
  const youtubeChannelUrl =
    process.env.YOUTUBE_CHANNEL_URL ||
    (process.env.YOUTUBE_CHANNEL_ID
      ? `https://www.youtube.com/channel/${process.env.YOUTUBE_CHANNEL_ID}`
      : "https://www.youtube.com/@Lolweapon");

  return (
    <HomePage
      activeView="home"
      initialLives={lives}
      initialLivesCoverage="partial"
      twitchLogin={twitchLogin}
      youtubeChannelUrl={youtubeChannelUrl}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={withPublicAccessPermissions(currentUser?.permissions)}
      initialAnimeActivity={animeActivity}
      initialPlatformUsers={platformUsers}
      initialPlatformRoles={platformRoles}
      initialPlatformPermissions={platformPermissions}
    />
  );
}
