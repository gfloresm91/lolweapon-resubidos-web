import { NextResponse } from "next/server";

import { SESSION_COOKIE, setSessionCookie } from "@/lib/auth";
import {
  buildGoogleAppUrl,
  exchangeGoogleCode,
  GOOGLE_OAUTH_INTENT_COOKIE,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  IDENTITY_LINK_COOKIE,
  OAUTH_REGISTER_COOKIE,
  oauthCookieOptions,
  verifyGoogleIdToken,
} from "@/lib/googleOAuth";
import {
  consumeIdentityLinkAttempt,
  createPlatformSession,
  linkOAuthIdentityToUser,
  resolveOAuthIdentity,
} from "@/lib/repositories/platformUserRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

function clearOAuthCookies(response) {
  for (const name of [GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_OAUTH_NONCE_COOKIE, GOOGLE_OAUTH_RETURN_COOKIE, GOOGLE_OAUTH_INTENT_COOKIE]) {
    response.cookies.set(name, "", oauthCookieOptions(0));
  }
}

function appendConnectedParam(path, provider) {
  const [baseAndQuery, hash = ""] = String(path || "/inicio").split("#");
  const [pathname, query = ""] = baseAndQuery.split("?");
  const params = new URLSearchParams(query);
  params.set("connected", provider);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

async function consumePendingLinkIfValid(request, userId) {
  const pendingLinkId = request.cookies.get(IDENTITY_LINK_COOKIE)?.value;
  if (!pendingLinkId) return null;

  try {
    return await consumeIdentityLinkAttempt(pendingLinkId, userId);
  } catch {
    return null;
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const nonce = request.cookies.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value;
  const storedReturnTo = request.cookies.get(GOOGLE_OAUTH_RETURN_COOKIE)?.value;
  const returnTo = storedReturnTo?.startsWith("/") && !storedReturnTo.startsWith("//") && !storedReturnTo.startsWith("/api/")
    ? storedReturnTo
    : "/inicio";
  const intent = request.cookies.get(GOOGLE_OAUTH_INTENT_COOKIE)?.value || "login";

  if (!code || !state || !expectedState || state !== expectedState || !nonce) {
    return NextResponse.redirect(buildGoogleAppUrl(request, "/login?error=No+se+pudo+validar+la+respuesta+de+Google"));
  }

  try {
    const profile = await verifyGoogleIdToken(await exchangeGoogleCode({ request, code }), nonce);
    const currentUser = await getCurrentUserFromToken(request.cookies.get(SESSION_COOKIE)?.value);

    if (intent === "connect") {
      if (!currentUser) throw new Error("Inicia sesión nuevamente antes de conectar Google.");
      await linkOAuthIdentityToUser(profile, currentUser.id);
      const response = NextResponse.redirect(buildGoogleAppUrl(request, "/perfil?connected=google"));
      clearOAuthCookies(response);
      return response;
    }

    const result = await resolveOAuthIdentity(profile);
    if (result.status === "link-required") {
      const loginMethods = Array.isArray(result.loginMethods) ? result.loginMethods : [];
      const loginMethod = loginMethods[0] ? `&loginMethod=${encodeURIComponent(loginMethods[0])}` : "";
      const loginMethodsParam = loginMethods.length ? `&loginMethods=${encodeURIComponent(loginMethods.join(","))}` : "";
      const response = NextResponse.redirect(buildGoogleAppUrl(request, `/login?linkRequired=google&returnTo=${encodeURIComponent(returnTo)}${loginMethod}${loginMethodsParam}`));
      response.cookies.set(IDENTITY_LINK_COOKIE, result.attemptId, oauthCookieOptions(900));
      response.cookies.set(OAUTH_REGISTER_COOKIE, "", oauthCookieOptions(0));
      clearOAuthCookies(response);
      return response;
    }

    if (result.status === "registration-required") {
      const response = NextResponse.redirect(buildGoogleAppUrl(request, `/registro?oauth=google&returnTo=${encodeURIComponent(returnTo)}`));
      response.cookies.set(OAUTH_REGISTER_COOKIE, result.attemptId, oauthCookieOptions(900));
      response.cookies.set(IDENTITY_LINK_COOKIE, "", oauthCookieOptions(0));
      clearOAuthCookies(response);
      return response;
    }

    const linkResult = await consumePendingLinkIfValid(request, result.user.id);
    const session = await createPlatformSession(result.user.id);
    const redirectTo = linkResult?.provider ? appendConnectedParam(returnTo, linkResult.provider) : returnTo;
    const response = NextResponse.redirect(buildGoogleAppUrl(request, redirectTo));
    setSessionCookie(response, request, session.token, session.expiresAt);
    response.cookies.set(IDENTITY_LINK_COOKIE, "", oauthCookieOptions(0));
    clearOAuthCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.redirect(buildGoogleAppUrl(request, `/login?error=${encodeURIComponent(error.message || "No se pudo iniciar sesión con Google.")}`));
    clearOAuthCookies(response);
    return response;
  }
}
