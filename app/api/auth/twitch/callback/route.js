import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import {
  createPlatformSession,
  findOrCreateTwitchUser,
} from "@/lib/repositories/platformUserRepository";
import {
  exchangeTwitchCode,
  fetchTwitchChannelMembership,
  fetchTwitchUserProfile,
  TWITCH_OAUTH_STATE_COOKIE,
} from "@/lib/twitchOAuth";

function redirectLogin(request, message) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(TWITCH_OAUTH_STATE_COOKIE)?.value;

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
    const response = NextResponse.redirect(new URL("/", request.url));

    response.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });
    response.cookies.set(TWITCH_OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return redirectLogin(request, error.message || "No se pudo iniciar sesión con Twitch.");
  }
}
