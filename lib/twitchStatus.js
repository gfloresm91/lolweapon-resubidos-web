import { fetchCurrentTwitchStream, fetchTwitchBroadcaster, fetchTwitchChannelInfo, fetchTwitchGame } from "./twitch.js";

const STATUS_CACHE_TTL_MS = 30 * 1000;
const STATUS_STALE_TTL_MS = 2 * 60 * 1000;

let statusCache = null;
let statusRefreshPromise = null;

export function getTwitchLogin() {
  return process.env.NEXT_PUBLIC_TWITCH_EMBED_LOGIN
    || process.env.TWITCH_BROADCASTER_LOGIN
    || "kalathraslolweapon";
}

export function createEmptyTwitchStatus(twitchLogin = getTwitchLogin()) {
  return {
    isOnline: false,
    stream: null,
    profile: null,
    channelInfo: null,
    game: null,
    twitchLogin,
  };
}

async function fetchStatus(twitchLogin) {
  const [stream, profile] = await Promise.all([
    fetchCurrentTwitchStream({ broadcasterLogin: twitchLogin }),
    fetchTwitchBroadcaster({ broadcasterLogin: twitchLogin }),
  ]);
  const channelInfo = await fetchTwitchChannelInfo({
    broadcasterUserId: profile.id,
    broadcasterLogin: profile.login,
  });
  const game = await fetchTwitchGame(stream?.game_id || channelInfo?.game_id).catch(() => null);

  return {
    isOnline: Boolean(stream),
    stream,
    profile,
    channelInfo,
    game,
    twitchLogin,
  };
}

function refreshStatus(twitchLogin) {
  if (!statusRefreshPromise) {
    statusRefreshPromise = fetchStatus(twitchLogin)
      .then((status) => {
        statusCache = { status, updatedAt: Date.now(), twitchLogin };
        return status;
      })
      .finally(() => {
        statusRefreshPromise = null;
      });
  }

  return statusRefreshPromise;
}

export async function getCachedTwitchStatus() {
  const twitchLogin = getTwitchLogin();
  const cacheAge = statusCache?.twitchLogin === twitchLogin
    ? Date.now() - statusCache.updatedAt
    : Number.POSITIVE_INFINITY;

  if (cacheAge <= STATUS_CACHE_TTL_MS) {
    return { status: statusCache.status, cacheStatus: "hit" };
  }

  try {
    const status = await refreshStatus(twitchLogin);
    return { status, cacheStatus: "refresh" };
  } catch (error) {
    if (cacheAge <= STATUS_STALE_TTL_MS) {
      return { status: statusCache.status, cacheStatus: "stale", error };
    }

    return { status: createEmptyTwitchStatus(twitchLogin), cacheStatus: "error", error };
  }
}
