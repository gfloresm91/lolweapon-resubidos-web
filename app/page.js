import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";

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
    />
  );
}
