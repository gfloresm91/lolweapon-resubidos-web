import { readLives, updateLiveStatus, upsertLive } from "@/lib/repositories/liveRepository";
import { buildLiveFromTwitchStream, fetchCurrentTwitchStream, fetchTwitchChannelInfo } from "@/lib/twitch";

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

  let eventWithTitle = event;
  if (trustedOnlineEvent && !event.title) {
    // El payload de stream.online no trae título. A diferencia de Get Streams, Get Channel
    // Information no depende de que Twitch ya refleje el stream como activo, así que es seguro
    // consultarlo acá sin arriesgar perder el evento si falla.
    try {
      const channel = await fetchTwitchChannelInfo({
        broadcasterUserId: event.broadcaster_user_id,
        broadcasterLogin: event.broadcaster_user_login,
      });
      if (channel?.title) {
        eventWithTitle = { ...event, title: channel.title };
      }
    } catch {
      // Best-effort: si falla, se mantiene el título genérico sin bloquear la creación del card.
    }
  }

  const live = buildLiveFromTwitchStream(stream, eventWithTitle);
  const existingLives = await readLives();
  const index = existingLives.findIndex((existingLive) => existingLive.id === live.id);
  const nextLives = [...existingLives];

  if (index >= 0) {
    nextLives[index] = {
      ...nextLives[index],
      ...live,
      links: nextLives[index].links,
      tags: Array.from(new Set([...nextLives[index].tags, ...live.tags])),
      image: live.image || nextLives[index].image,
    };
  } else {
    nextLives.unshift(live);
  }

  await upsertLive(index >= 0 ? nextLives[index] : live);

  return live;
}

export async function markCurrentTwitchLiveAsUploading() {
  const existingLives = await readLives();
  const live = existingLives.find((existingLive) => (
    String(existingLive.id || "").startsWith("twitch_")
    && existingLive.status === "En directo"
  ));

  if (!live) {
    return null;
  }

  await updateLiveStatus(live.id, "Subiendo");
  return {
    before: live,
    live: { ...live, status: "Subiendo" },
  };
}
