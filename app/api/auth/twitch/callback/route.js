import { NextResponse } from "next/server";

import { SESSION_COOKIE, setSessionCookie } from "@/lib/auth";
import { IDENTITY_LINK_COOKIE, OAUTH_REGISTER_COOKIE, oauthCookieOptions } from "@/lib/googleOAuth";
import {
  consumeIdentityLinkAttempt,
  createPlatformSession,
  findOrCreateTwitchUser,
  linkOAuthIdentityToUser,
} from "@/lib/repositories/platformUserRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";
import {
  buildTwitchAppUrl,
  exchangeTwitchCode,
  fetchTwitchChannelMembership,
  fetchTwitchUserProfile,
  TWITCH_OAUTH_RETURN_COOKIE,
  TWITCH_OAUTH_INTENT_COOKIE,
  TWITCH_OAUTH_STATE_COOKIE,
} from "@/lib/twitchOAuth";

function getSafeReturnPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/")) {
    return null;
  }

  const pathname = value.split("?")[0].split("#")[0];
  if (["/login", "/registro"].includes(pathname)) {
    return null;
  }

  return value;
}

function redirectLogin(request, message) {
  const returnTo = getSafeReturnPath(request.cookies.get(TWITCH_OAUTH_RETURN_COOKIE)?.value);
  const loginPath = returnTo
    ? `/login?error=${encodeURIComponent(message)}&returnTo=${encodeURIComponent(returnTo)}`
    : `/login?error=${encodeURIComponent(message)}`;

  const response = NextResponse.redirect(buildTwitchAppUrl(request, loginPath));
  clearTwitchOAuthCookies(response);
  return response;
}

function clearTwitchOAuthCookies(response) {
  for (const name of [TWITCH_OAUTH_STATE_COOKIE, TWITCH_OAUTH_RETURN_COOKIE, TWITCH_OAUTH_INTENT_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
  }
}

function appendConnectedParam(path, provider) {
  const [baseAndQuery, hash = ""] = String(path || "/").split("#");
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
  const expectedState = request.cookies.get(TWITCH_OAUTH_STATE_COOKIE)?.value;
  const returnTo = getSafeReturnPath(request.cookies.get(TWITCH_OAUTH_RETURN_COOKIE)?.value) || "/";
  const intent = request.cookies.get(TWITCH_OAUTH_INTENT_COOKIE)?.value || "login";

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectLogin(request, "No se pudo validar la respuesta de Twitch.");
  }

  try {
    const { accessToken } = await exchangeTwitchCode({ request, code });
    const profile = await fetchTwitchUserProfile(accessToken);
    const twitchMembership = await fetchTwitchChannelMembership({
      accessToken,
      userId: profile.id,
    });
    const oauthProfile = {
      provider: "twitch",
      providerSubject: profile.id,
      providerEmail: profile.email,
      emailVerified: false,
      providerLogin: profile.login,
      displayName: profile.alias,
      avatarUrl: profile.avatarUrl,
      metadata: { twitchMembership },
    };
    const currentUser = await getCurrentUserFromToken(request.cookies.get(SESSION_COOKIE)?.value);

    if (intent === "connect") {
      if (!currentUser) return redirectLogin(request, "Inicia sesión nuevamente antes de conectar Twitch.");
      await linkOAuthIdentityToUser(oauthProfile, currentUser.id);
      const response = NextResponse.redirect(buildTwitchAppUrl(request, "/perfil?connected=twitch"));
      clearTwitchOAuthCookies(response);
      return response;
    }

    const result = await findOrCreateTwitchUser({ ...profile, twitchMembership });

    if (result.status === "link-required") {
      const loginMethods = Array.isArray(result.loginMethods) ? result.loginMethods : [];
      const loginMethod = loginMethods[0] ? `&loginMethod=${encodeURIComponent(loginMethods[0])}` : "";
      const loginMethodsParam = loginMethods.length ? `&loginMethods=${encodeURIComponent(loginMethods.join(","))}` : "";
      const response = NextResponse.redirect(buildTwitchAppUrl(request, `/login?linkRequired=twitch&returnTo=${encodeURIComponent(returnTo)}${loginMethod}${loginMethodsParam}`));
      response.cookies.set(IDENTITY_LINK_COOKIE, result.attemptId, oauthCookieOptions(900));
      response.cookies.set(OAUTH_REGISTER_COOKIE, "", oauthCookieOptions(0));
      clearTwitchOAuthCookies(response);
      return response;
    }

    if (result.status === "registration-required") {
      const response = NextResponse.redirect(buildTwitchAppUrl(request, `/registro?oauth=twitch&returnTo=${encodeURIComponent(returnTo)}`));
      response.cookies.set(OAUTH_REGISTER_COOKIE, result.attemptId, oauthCookieOptions(900));
      response.cookies.set(IDENTITY_LINK_COOKIE, "", oauthCookieOptions(0));
      clearTwitchOAuthCookies(response);
      return response;
    }

    const linkResult = await consumePendingLinkIfValid(request, result.user.id);
    const session = await createPlatformSession(result.user.id);
    const redirectTo = linkResult?.provider ? appendConnectedParam(returnTo, linkResult.provider) : returnTo;
    const response = NextResponse.redirect(buildTwitchAppUrl(request, redirectTo));

    setSessionCookie(response, request, session.token, session.expiresAt);
    clearTwitchOAuthCookies(response);
    response.cookies.set(IDENTITY_LINK_COOKIE, "", oauthCookieOptions(0));

    return response;
  } catch (error) {
    return redirectLogin(request, error.message || "No se pudo iniciar sesión con Twitch.");
  }
}
