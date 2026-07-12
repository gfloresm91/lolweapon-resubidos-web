import crypto from "node:crypto";
import { NextResponse } from "next/server";

import {
  buildGoogleAppUrl,
  buildGoogleAuthorizeUrl,
  GOOGLE_OAUTH_INTENT_COOKIE,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  oauthCookieOptions,
} from "@/lib/googleOAuth";

function safeReturnPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/")) return null;
  return ["/login", "/registro"].includes(value.split("?")[0].split("#")[0]) ? null : value;
}

export async function GET(request) {
  try {
    const state = crypto.randomBytes(24).toString("hex");
    const nonce = crypto.randomBytes(24).toString("hex");
    const url = new URL(request.url);
    const returnTo = safeReturnPath(url.searchParams.get("returnTo")) || safeReturnPath(url.searchParams.get("next"));
    const intent = url.searchParams.get("intent") === "connect" ? "connect" : "login";
    const response = NextResponse.redirect(buildGoogleAuthorizeUrl({ request, state, nonce }));
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, oauthCookieOptions());
    response.cookies.set(GOOGLE_OAUTH_NONCE_COOKIE, nonce, oauthCookieOptions());
    response.cookies.set(GOOGLE_OAUTH_INTENT_COOKIE, intent, oauthCookieOptions());
    if (returnTo) response.cookies.set(GOOGLE_OAUTH_RETURN_COOKIE, returnTo, oauthCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.redirect(buildGoogleAppUrl(request, `/login?error=${encodeURIComponent(error.message)}`));
  }
}
