import { readLives, upsertLive } from "@/lib/repositories/liveRepository";
import { buildLiveFromTwitchStream, fetchCurrentTwitchStream } from "@/lib/twitch";

export async function upsertTwitchLive(event = {}, { trustedOnlineEvent = false } = {}) {
  const stream = trustedOnlineEvent
    ? null
    : await fetchCurrentTwitchStream({
      broadcasterUserId: event.broadcaster_user_id,
      broadcasterLogin: event.broadcaster_user_login,
    });

  if (!stream && !trustedOnlineEvent && process.env.TWITCH_REQUIRE_ACTIVE_STREAM === "true") {
    return null;
  }

  const live = buildLiveFromTwitchStream(stream, event);
  const existingLives = await readLives();
  const index = existingLives.findIndex((existingLive) => existingLive.id === live.id);
  const nextLives = [...existingLives];

  if (index >= 0) {
    nextLives[index] = {
      ...nextLives[index],
      ...live,
      links: nextLives[index].links,
      tags: Array.from(new Set([...nextLives[index].tags, ...live.tags])),
    };
  } else {
    nextLives.unshift(live);
  }

  await upsertLive(index >= 0 ? nextLives[index] : live);

  return live;
}
