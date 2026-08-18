const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_USERS_URL = "https://api.twitch.tv/helix/users";
const TWITCH_SUBSCRIPTION_URL = "https://api.twitch.tv/helix/subscriptions/user";
const TWITCH_MODERATED_CHANNELS_URL = "https://api.twitch.tv/helix/moderation/channels";
const TWITCH_VIPS_URL = "https://api.twitch.tv/helix/channels/vips";
const DEFAULT_TWITCH_BROADCASTER_LOGIN = "kalathraslolweapon";

export const TWITCH_OAUTH_STATE_COOKIE = "kala_twitch_oauth_state";
export const TWITCH_OAUTH_RETURN_COOKIE = "kala_twitch_oauth_return_to";
export const TWITCH_OAUTH_INTENT_COOKIE = "kala_twitch_oauth_intent";

function getClientId() {
  const clientId = process.env.TWITCH_CLIENT_ID;

  if (!clientId) {
    throw new Error("Falta configurar TWITCH_CLIENT_ID.");
  }

  return clientId;
}

function getClientSecret() {
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("Falta configurar TWITCH_CLIENT_SECRET.");
  }

  return clientSecret;
}

function getBroadcasterLogin() {
  return (process.env.TWITCH_BROADCASTER_LOGIN || DEFAULT_TWITCH_BROADCASTER_LOGIN).trim().toLowerCase();
}

function buildHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": getClientId(),
  };
}

function getConfiguredHostnames() {
  return [
    process.env.RESUBIDOS_HOST,
    process.env.VIENDO_HOST,
    process.env.TWITCH_AUTH_REDIRECT_URI ? new URL(process.env.TWITCH_AUTH_REDIRECT_URI).hostname : "",
  ]
    .map((host) => String(host || "").trim().toLowerCase())
    .filter(Boolean);
}

function getRequestOrigin(request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : new URL(request.url).protocol.replace(":", ""));

  return `${protocol}://${host}`;
}

const DEFAULT_TWITCH_REDIRECT_PATH = "/api/auth/twitch/callback";

export function getTwitchRedirectUri(request, redirectPath = DEFAULT_TWITCH_REDIRECT_PATH) {
  const requestOrigin = getRequestOrigin(request);
  const requestHostname = new URL(requestOrigin).hostname.toLowerCase();
  const configuredHostnames = getConfiguredHostnames();
  const isDefaultPath = redirectPath === DEFAULT_TWITCH_REDIRECT_PATH;

  // Non-default paths (mobile routes) always derive from the real request origin - the fixed
  // TWITCH_AUTH_REDIRECT_URI env var only ever points at the web callback path.
  if (!isDefaultPath || configuredHostnames.includes(requestHostname)) {
    return new URL(redirectPath, requestOrigin).toString();
  }

  return process.env.TWITCH_AUTH_REDIRECT_URI || new URL(redirectPath, requestOrigin).toString();
}

export function buildTwitchAppUrl(request, pathname = "/") {
  return new URL(pathname, getTwitchRedirectUri(request));
}

export function buildTwitchAuthorizeUrl({ request, state, redirectPath }) {
  const url = new URL(TWITCH_AUTHORIZE_URL);
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("redirect_uri", getTwitchRedirectUri(request, redirectPath));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [
    "user:read:email",
    "user:read:subscriptions",
    "user:read:moderated_channels",
  ].join(" "));
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeTwitchCode({ request, code, redirectPath }) {
  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: getTwitchRedirectUri(request, redirectPath),
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.message || "No se pudo validar el código de Twitch.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || null,
    scopes: data.scope || [],
  };
}

export async function fetchTwitchUserProfile(accessToken) {
  const response = await fetch(TWITCH_USERS_URL, {
    headers: buildHeaders(accessToken),
  });
  const data = await response.json();
  const user = data?.data?.[0];

  if (!response.ok || !user) {
    throw new Error(data.message || "No se pudo obtener el usuario de Twitch.");
  }

  return {
    id: user.id,
    login: user.login,
    alias: user.display_name || user.login,
    email: user.email || null,
    avatarUrl: user.profile_image_url || null,
  };
}

async function fetchTwitchUserByLogin(accessToken, login) {
  const url = new URL(TWITCH_USERS_URL);
  url.searchParams.set("login", login);

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
  });
  const data = await response.json();
  const user = data?.data?.[0];

  if (!response.ok || !user) {
    throw new Error(data.message || `No se pudo obtener el canal de Twitch ${login}.`);
  }

  return user;
}

async function fetchSubscriptionTier({ accessToken, broadcasterId, userId }) {
  const url = new URL(TWITCH_SUBSCRIPTION_URL);
  url.searchParams.set("broadcaster_id", broadcasterId);
  url.searchParams.set("user_id", userId);

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
  });

  if (response.status === 404) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No se pudo consultar la suscripción de Twitch.");
  }

  return data?.data?.[0]?.tier || null;
}

async function fetchModeratorStatus({ accessToken, broadcasterId, userId }) {
  const url = new URL(TWITCH_MODERATED_CHANNELS_URL);
  url.searchParams.set("user_id", userId);
  url.searchParams.set("first", "100");

  let cursor = null;

  do {
    if (cursor) {
      url.searchParams.set("after", cursor);
    }

    const response = await fetch(url, {
      headers: buildHeaders(accessToken),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "No se pudo consultar si el usuario es moderador.");
    }

    if ((data?.data || []).some((channel) => channel.broadcaster_id === broadcasterId)) {
      return true;
    }

    cursor = data?.pagination?.cursor || null;
  } while (cursor);

  return false;
}

async function fetchVipStatus({ broadcasterId, userId }) {
  const broadcasterAccessToken = process.env.TWITCH_BROADCASTER_ACCESS_TOKEN;

  if (!broadcasterAccessToken) {
    return false;
  }

  const url = new URL(TWITCH_VIPS_URL);
  url.searchParams.set("broadcaster_id", broadcasterId);
  url.searchParams.append("user_id", userId);

  const response = await fetch(url, {
    headers: buildHeaders(broadcasterAccessToken),
  });
  const data = await response.json();

  if (!response.ok) {
    console.warn("No se pudo consultar si el usuario es VIP en Twitch.", data.message || response.status);
    return false;
  }

  return Boolean(data?.data?.length);
}

export async function fetchTwitchChannelMembership({ accessToken, userId }) {
  const broadcaster = await fetchTwitchUserByLogin(accessToken, getBroadcasterLogin());
  const [subscriberTier, isModerator, isVip] = await Promise.all([
    fetchSubscriptionTier({ accessToken, broadcasterId: broadcaster.id, userId }),
    fetchModeratorStatus({ accessToken, broadcasterId: broadcaster.id, userId }),
    fetchVipStatus({ broadcasterId: broadcaster.id, userId }),
  ]);

  return {
    broadcasterId: broadcaster.id,
    broadcasterLogin: broadcaster.login,
    subscriberTier,
    isModerator,
    isVip,
  };
}
