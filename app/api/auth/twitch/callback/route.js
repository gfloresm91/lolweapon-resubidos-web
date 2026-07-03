import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import {
  createPlatformSession,
  findOrCreateTwitchUser,
} from "@/lib/repositories/platformUserRepository";
import {
  buildTwitchAppUrl,
  exchangeTwitchCode,
  fetchTwitchChannelMembership,
  fetchTwitchUserProfile,
  TWITCH_OAUTH_RETURN_COOKIE,
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

  return NextResponse.redirect(buildTwitchAppUrl(request, loginPath));
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(TWITCH_OAUTH_STATE_COOKIE)?.value;
  const returnTo = getSafeReturnPath(request.cookies.get(TWITCH_OAUTH_RETURN_COOKIE)?.value) || "/";

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
    const user = await findOrCreateTwitchUser({ ...profile, twitchMembership });

    if (!user) {
      return redirectLogin(request, "Tu usuario de Twitch todavía no está habilitado en la plataforma.");
    }

    const session = await createPlatformSession(user.id);
    const response = NextResponse.redirect(buildTwitchAppUrl(request, returnTo));

    setSessionCookie(response, request, session.token, session.expiresAt);
    response.cookies.set(TWITCH_OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    response.cookies.set(TWITCH_OAUTH_RETURN_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return redirectLogin(request, error.message || "No se pudo iniciar sesión con Twitch.");
  }
}
