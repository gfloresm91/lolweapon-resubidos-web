import { normalizeLive } from "@/lib/lives";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_API_URL = "https://api.twitch.tv/helix";
const DEFAULT_TIME_ZONE = "America/Santiago";

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

export async function getAppAccessToken() {
  const clientId = getRequiredEnv("TWITCH_CLIENT_ID");
  const clientSecret = getRequiredEnv("TWITCH_CLIENT_SECRET");
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(`${TWITCH_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.message || "No se pudo obtener token de Twitch");
  }

  return data.access_token;
}

async function twitchFetch(path, token) {
  const clientId = getRequiredEnv("TWITCH_CLIENT_ID");
  const response = await fetch(`${TWITCH_API_URL}${path}`, {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error consultando Twitch");
  }

  return data;
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
