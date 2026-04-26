import { NextResponse } from "next/server";

import { fetchCurrentTwitchStream, fetchTwitchBroadcaster, fetchTwitchChannelInfo, fetchTwitchGame } from "@/lib/twitch";

export const dynamic = "force-dynamic";

export async function GET() {
  const twitchLogin = process.env.TWITCH_BROADCASTER_LOGIN || "kalathraslolweapon";
  const [stream, profile, channelInfo] = await Promise.all([
    fetchCurrentTwitchStream({ broadcasterLogin: twitchLogin }).catch(() => null),
    fetchTwitchBroadcaster({ broadcasterLogin: twitchLogin }).catch(() => null),
    fetchTwitchChannelInfo({ broadcasterLogin: twitchLogin }).catch(() => null),
  ]);
  const game = await fetchTwitchGame(stream?.game_id || channelInfo?.game_id).catch(() => null);

  return NextResponse.json({
    isOnline: Boolean(stream),
    stream,
    profile,
    channelInfo,
    game,
    twitchLogin,
  });
}
