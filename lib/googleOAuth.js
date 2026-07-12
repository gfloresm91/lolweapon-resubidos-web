import crypto from "node:crypto";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export const GOOGLE_OAUTH_STATE_COOKIE = "kala_google_oauth_state";
export const GOOGLE_OAUTH_NONCE_COOKIE = "kala_google_oauth_nonce";
export const GOOGLE_OAUTH_RETURN_COOKIE = "kala_google_oauth_return_to";
export const GOOGLE_OAUTH_INTENT_COOKIE = "kala_google_oauth_intent";
export const IDENTITY_LINK_COOKIE = "kala_identity_link";
export const OAUTH_REGISTER_COOKIE = "kala_oauth_register";

let jwksCache = { expiresAt: 0, keys: [] };

function getClientId() {
  const value = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!value) throw new Error("Falta configurar GOOGLE_CLIENT_ID.");
  return value;
}

function getClientSecret() {
  const value = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!value) throw new Error("Falta configurar GOOGLE_CLIENT_SECRET.");
  return value;
}

function getRequestOrigin(request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : new URL(request.url).protocol.replace(":", ""));
  return `${protocol}://${host}`;
}

function configuredHostnames() {
  return [process.env.RESUBIDOS_HOST, process.env.VIENDO_HOST]
    .map((host) => String(host || "").trim().toLowerCase())
    .filter(Boolean);
}

export function getGoogleRedirectUri(request) {
  const requestOrigin = getRequestOrigin(request);
  const hostname = new URL(requestOrigin).hostname.toLowerCase();
  if (configuredHostnames().includes(hostname)) {
    return new URL("/api/auth/google/callback", requestOrigin).toString();
  }
  return process.env.GOOGLE_AUTH_REDIRECT_URI || new URL("/api/auth/google/callback", requestOrigin).toString();
}

export function buildGoogleAppUrl(request, pathname = "/") {
  return new URL(pathname, getGoogleRedirectUri(request));
}

export function buildGoogleAuthorizeUrl({ request, state, nonce }) {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("redirect_uri", getGoogleRedirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleCode({ request, code }) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: getGoogleRedirectUri(request),
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.id_token) {
    throw new Error(data.error_description || "No se pudo validar el código de Google.");
  }
  return data.id_token;
}

function decodePart(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

async function getGoogleJwks() {
  if (jwksCache.expiresAt > Date.now() && jwksCache.keys.length) return jwksCache.keys;
  const response = await fetch(GOOGLE_JWKS_URL);
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.keys)) throw new Error("No se pudieron validar las claves de Google.");
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys: data.keys, expiresAt: Date.now() + maxAge * 1000 };
  return data.keys;
}

export async function verifyGoogleIdToken(idToken, expectedNonce) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("Google entregó una identidad inválida.");
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Google entregó una firma no soportada.");
  const key = (await getGoogleJwks()).find((item) => item.kid === header.kid);
  if (!key) throw new Error("No se encontró la clave de firma de Google.");
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key, format: "jwk" }),
    Buffer.from(parts[2], "base64url"),
  );
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!verified || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) {
    throw new Error("No se pudo verificar la identidad de Google.");
  }
  if (!audiences.includes(getClientId()) || Number(claims.exp) * 1000 <= Date.now() || claims.nonce !== expectedNonce) {
    throw new Error("La respuesta de Google expiró o no corresponde a esta solicitud.");
  }
  if (!claims.sub || !claims.email || claims.email_verified !== true) {
    throw new Error("Google no entregó un correo verificado.");
  }
  return {
    provider: "google",
    providerSubject: claims.sub,
    providerEmail: claims.email,
    emailVerified: true,
    providerLogin: null,
    displayName: claims.name || claims.email.split("@")[0],
    avatarUrl: claims.picture || null,
    metadata: { locale: claims.locale || null },
  };
}

export function oauthCookieOptions(maxAge = 600) {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge };
}
