import { NextResponse } from "next/server";

import { exchangeGoogleCode, oauthCookieOptions, verifyGoogleIdToken } from "@/lib/googleOAuth";
import { createOAuthExchange } from "@/lib/mobileAuth";
import { resolveOAuthIdentity } from "@/lib/repositories/platformUserRepository";
import { exchangeTwitchCode, fetchTwitchChannelMembership, fetchTwitchUserProfile } from "@/lib/twitchOAuth";

import {
  CLIENT_TYPE_COOKIE,
  DEVICE_ID_COOKIE,
  NONCE_COOKIE,
  redirectPathFor,
  SCHEME_COOKIE,
  STATE_COOKIE,
} from "../start/route";

function clearMobileOAuthCookies(response) {
  for (const name of [STATE_COOKIE, NONCE_COOKIE, CLIENT_TYPE_COOKIE, DEVICE_ID_COOKIE, SCHEME_COOKIE]) {
    response.cookies.set(name, "", oauthCookieOptions(0));
  }
}

function errorRedirect(scheme, message) {
  return NextResponse.redirect(`${scheme}://auth-callback?error=${encodeURIComponent(message)}`);
}

async function resolveProviderProfile(provider, request, code, redirectPath) {
  if (provider === "twitch") {
    const { accessToken } = await exchangeTwitchCode({ request, code, redirectPath });
    const profile = await fetchTwitchUserProfile(accessToken);
    const twitchMembership = await fetchTwitchChannelMembership({ accessToken, userId: profile.id });
    return {
      provider: "twitch",
      providerSubject: profile.id,
      providerEmail: profile.email,
      emailVerified: false,
      providerLogin: profile.login,
      displayName: profile.alias,
      avatarUrl: profile.avatarUrl,
      metadata: { twitchMembership },
    };
  }

  const nonce = request.cookies.get(NONCE_COOKIE)?.value;
  const idToken = await exchangeGoogleCode({ request, code, redirectPath });
  return verifyGoogleIdToken(idToken, nonce);
}

export async function GET(request, { params }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const clientType = request.cookies.get(CLIENT_TYPE_COOKIE)?.value || "unknown";
  const scheme = request.cookies.get(SCHEME_COOKIE)?.value;

  if (!scheme) {
    return NextResponse.json({ success: false, error: "Sesión OAuth mobile expiró o es inválida." }, { status: 400 });
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    const response = errorRedirect(scheme, "No se pudo validar la respuesta del proveedor.");
    clearMobileOAuthCookies(response);
    return response;
  }

  const redirectPath = redirectPathFor(provider);

  try {
    const oauthProfile = await resolveProviderProfile(provider, request, code, redirectPath);
    const result = await resolveOAuthIdentity(oauthProfile);

    if (result.status === "link-required") {
      const dest = new URL("/mobile-auth/vincular", request.url);
      dest.searchParams.set("attemptId", result.attemptId);
      dest.searchParams.set("scheme", scheme);
      dest.searchParams.set("clientType", clientType);
      const response = NextResponse.redirect(dest);
      clearMobileOAuthCookies(response);
      return response;
    }

    if (result.status === "registration-required") {
      const dest = new URL("/mobile-auth/registro", request.url);
      dest.searchParams.set("attemptId", result.attemptId);
      dest.searchParams.set("scheme", scheme);
      dest.searchParams.set("clientType", clientType);
      if (result.registration?.login) dest.searchParams.set("suggestedLogin", result.registration.login);
      if (result.registration?.alias) dest.searchParams.set("suggestedAlias", result.registration.alias);
      const response = NextResponse.redirect(dest);
      clearMobileOAuthCookies(response);
      return response;
    }

    const exchange = await createOAuthExchange({ userId: result.user.id, provider, clientType });
    const response = NextResponse.redirect(`${scheme}://auth-callback?exchangeCode=${encodeURIComponent(exchange.code)}`);
    clearMobileOAuthCookies(response);
    return response;
  } catch (error) {
    const response = errorRedirect(scheme, error.message || "No se pudo iniciar sesión.");
    clearMobileOAuthCookies(response);
    return response;
  }
}
