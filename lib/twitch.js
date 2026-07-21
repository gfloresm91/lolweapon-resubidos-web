import { normalizeLive } from "@/lib/lives";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_API_URL = "https://api.twitch.tv/helix";
const DEFAULT_TIME_ZONE = "America/Santiago";
const TWITCH_REQUEST_TIMEOUT_MS = 10 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

let appAccessTokenCache = null;
let appAccessTokenPromise = null;

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta configurar ${name}`);
  }

  return value;
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  const formatter = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: process.env.TWITCH_ARCHIVE_TIME_ZONE || DEFAULT_TIME_ZONE,
  });

  return formatter.format(date).replaceAll("-", "/");
}

function buildThumbnailUrl(thumbnailUrl) {
  return String(thumbnailUrl || "")
    .replace("{width}", "640")
    .replace("{height}", "360");
}

function requestSignal() {
  return AbortSignal.timeout(TWITCH_REQUEST_TIMEOUT_MS);
}

function invalidateAppAccessToken(token) {
  if (!token || appAccessTokenCache?.token === token) {
    appAccessTokenCache = null;
  }
}

async function requestAppAccessToken() {
  const clientId = getRequiredEnv("TWITCH_CLIENT_ID");
  const clientSecret = getRequiredEnv("TWITCH_CLIENT_SECRET");
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(`${TWITCH_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
    signal: requestSignal(),
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.message || "No se pudo obtener token de Twitch");
  }

  const expiresInMs = Math.max(0, Number(data.expires_in) || 0) * 1000;
  appAccessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, expiresInMs - TOKEN_EXPIRY_SKEW_MS),
  };

  return appAccessTokenCache.token;
}

export async function getAppAccessToken() {
  if (appAccessTokenCache?.token && appAccessTokenCache.expiresAt > Date.now()) {
    return appAccessTokenCache.token;
  }

  if (!appAccessTokenPromise) {
    appAccessTokenPromise = requestAppAccessToken().finally(() => {
      appAccessTokenPromise = null;
    });
  }

  return appAccessTokenPromise;
}

async function twitchFetch(path, token) {
  const clientId = getRequiredEnv("TWITCH_CLIENT_ID");
  let activeToken = token;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${TWITCH_API_URL}${path}`, {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${activeToken}`,
      },
      cache: "no-store",
      signal: requestSignal(),
    });
    const data = await response.json();

    if (response.status === 401 && attempt === 0) {
      invalidateAppAccessToken(activeToken);
      activeToken = await getAppAccessToken();
      continue;
    }

    if (!response.ok) {
      throw new Error(data.message || "Error consultando Twitch");
    }

    return data;
  }

  throw new Error("No se pudo renovar el token de Twitch");
}

export async function fetchTwitchBroadcaster({ broadcasterUserId, broadcasterLogin } = {}) {
  if (broadcasterUserId) {
    return { id: broadcasterUserId, login: broadcasterLogin || "" };
  }

  const token = await getAppAccessToken();
  const login = broadcasterLogin || getRequiredEnv("TWITCH_BROADCASTER_LOGIN");
  const params = new URLSearchParams({ login });
  const data = await twitchFetch(`/users?${params.toString()}`, token);
  const user = data.data?.[0];

  if (!user?.id) {
    throw new Error(`No se encontro el canal de Twitch: ${login}`);
  }

  return user;
}

export async function fetchCurrentTwitchStream({ broadcasterUserId, broadcasterLogin } = {}) {
  const token = await getAppAccessToken();
  const params = new URLSearchParams();

  if (broadcasterUserId) {
    params.set("user_id", broadcasterUserId);
  } else {
    params.set("user_login", broadcasterLogin || getRequiredEnv("TWITCH_BROADCASTER_LOGIN"));
  }

  const data = await twitchFetch(`/streams?${params.toString()}`, token);
  return data.data?.[0] || null;
}

export async function fetchTwitchChannelInfo({ broadcasterUserId, broadcasterLogin } = {}) {
  const token = await getAppAccessToken();
  const broadcaster = await fetchTwitchBroadcaster({ broadcasterUserId, broadcasterLogin });
  const params = new URLSearchParams({ broadcaster_id: broadcaster.id });
  const data = await twitchFetch(`/channels?${params.toString()}`, token);

  return data.data?.[0] || null;
}

export async function fetchTwitchGame(gameId) {
  if (!gameId) {
    return null;
  }

  const token = await getAppAccessToken();
  const params = new URLSearchParams({ id: gameId });
  const data = await twitchFetch(`/games?${params.toString()}`, token);

  return data.data?.[0] || null;
}

export async function createStreamOnlineSubscription() {
  const token = await getAppAccessToken();
  const clientId = getRequiredEnv("TWITCH_CLIENT_ID");
  const callback = getRequiredEnv("TWITCH_EVENTSUB_CALLBACK_URL");
  const secret = getRequiredEnv("TWITCH_EVENTSUB_SECRET");
  const broadcaster = await fetchTwitchBroadcaster();
  const response = await fetch(`${TWITCH_API_URL}/eventsub/subscriptions`, {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "stream.online",
      version: "1",
      condition: {
        broadcaster_user_id: broadcaster.id,
      },
      transport: {
        method: "webhook",
        callback,
        secret,
      },
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No se pudo crear la suscripcion EventSub");
  }

  return data;
}

export async function findActiveStreamOnlineSubscription() {
  const token = await getAppAccessToken();
  const broadcaster = await fetchTwitchBroadcaster();
  const params = new URLSearchParams({
    type: "stream.online",
    user_id: broadcaster.id,
  });
  const data = await twitchFetch(`/eventsub/subscriptions?${params.toString()}`, token);

  return (data.data || []).find((subscription) => (
    subscription.type === "stream.online"
    && subscription.version === "1"
    && subscription.status === "enabled"
    && subscription.condition?.broadcaster_user_id === broadcaster.id
  )) || null;
}

export function buildLiveFromTwitchStream(stream, event = {}) {
  const startedAt = stream?.started_at || event.started_at || new Date().toISOString();
  const broadcasterLogin = stream?.user_login || event.broadcaster_user_login || process.env.TWITCH_BROADCASTER_LOGIN;
  const twitchUrl = broadcasterLogin ? `https://www.twitch.tv/${broadcasterLogin}` : "https://www.twitch.tv";
  const title = stream?.title || event.title || "Directo iniciado en Twitch";
  const category = stream?.game_name ? `Categoria: ${stream.game_name}` : "";
  const tags = ["Twitch", stream?.game_name].filter(Boolean);

  return normalizeLive({
    id: `twitch_${stream?.id || event.id || Date.parse(startedAt)}`,
    title,
    year: String(new Date(startedAt).getFullYear()),
    date: formatDate(startedAt),
    status: "En directo",
    tags,
    links: {
      telegram: [],
      okru: [],
      piero: [],
      patreon: [],
    },
    image: buildThumbnailUrl(stream?.thumbnail_url),
    additional_info: [
      "Registro creado automaticamente al iniciar directo en Twitch.",
      category,
      stream?.started_at ? `Inicio: ${stream.started_at}` : "",
      typeof stream?.viewer_count === "number" ? `Viewers al crear: ${stream.viewer_count}` : "",
      twitchUrl,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
