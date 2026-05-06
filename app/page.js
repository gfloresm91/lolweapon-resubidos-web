import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isAdmin = validateSessionToken(token);
  const [lives, liveStatuses] = await Promise.all([
    readLives(),
    getLiveStatuses(),
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
    />
  );
}
