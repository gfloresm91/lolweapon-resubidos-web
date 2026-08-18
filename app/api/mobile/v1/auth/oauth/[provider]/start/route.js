import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { oauthCookieOptions } from "@/lib/googleOAuth";
import { buildGoogleAuthorizeUrl } from "@/lib/googleOAuth";
import { buildTwitchAuthorizeUrl } from "@/lib/twitchOAuth";

export const STATE_COOKIE = "kala_mobile_oauth_state";
export const NONCE_COOKIE = "kala_mobile_oauth_nonce";
export const CLIENT_TYPE_COOKIE = "kala_mobile_oauth_client_type";
export const DEVICE_ID_COOKIE = "kala_mobile_oauth_device_id";
export const SCHEME_COOKIE = "kala_mobile_oauth_scheme";

const SUPPORTED_PROVIDERS = new Set(["twitch", "google"]);
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/i;

export function redirectPathFor(provider) {
  return `/api/mobile/v1/auth/oauth/${provider}/callback`;
}

export async function GET(request, { params }) {
  const { provider } = await params;

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return NextResponse.json({ success: false, error: "Proveedor no soportado." }, { status: 400 });
  }

  const url = new URL(request.url);
  const clientType = url.searchParams.get("clientType") || "unknown";
  const deviceId = url.searchParams.get("deviceId") || "";
  const scheme = url.searchParams.get("scheme");

  if (!scheme || !SCHEME_PATTERN.test(scheme)) {
    return NextResponse.json({ success: false, error: "Falta o es inválido el parámetro scheme." }, { status: 400 });
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectPath = redirectPathFor(provider);
  const nonce = provider === "google" ? crypto.randomBytes(16).toString("hex") : null;

  const authorizeUrl = provider === "twitch"
    ? buildTwitchAuthorizeUrl({ request, state, redirectPath })
    : buildGoogleAuthorizeUrl({ request, state, nonce, redirectPath });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, oauthCookieOptions(600));
  response.cookies.set(CLIENT_TYPE_COOKIE, clientType, oauthCookieOptions(600));
  response.cookies.set(DEVICE_ID_COOKIE, deviceId, oauthCookieOptions(600));
  response.cookies.set(SCHEME_COOKIE, scheme, oauthCookieOptions(600));
  if (nonce) {
    response.cookies.set(NONCE_COOKIE, nonce, oauthCookieOptions(600));
  }

  return response;
}
