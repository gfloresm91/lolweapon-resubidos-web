import crypto from "node:crypto";

import { NextResponse } from "next/server";

import {
  buildTwitchAppUrl,
  buildTwitchAuthorizeUrl,
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

export async function GET(request) {
  try {
    const state = crypto.randomBytes(24).toString("hex");
    const url = new URL(request.url);
    const returnTo = getSafeReturnPath(url.searchParams.get("returnTo")) || getSafeReturnPath(url.searchParams.get("next"));
    const response = NextResponse.redirect(buildTwitchAuthorizeUrl({ request, state }));

    response.cookies.set(TWITCH_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    if (returnTo) {
      response.cookies.set(TWITCH_OAUTH_RETURN_COOKIE, returnTo, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 10,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.redirect(buildTwitchAppUrl(request, `/login?error=${encodeURIComponent(error.message)}`));
  }
}
