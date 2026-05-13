import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { buildTwitchAppUrl, buildTwitchAuthorizeUrl, TWITCH_OAUTH_STATE_COOKIE } from "@/lib/twitchOAuth";

export async function GET(request) {
  try {
    const state = crypto.randomBytes(24).toString("hex");
    const response = NextResponse.redirect(buildTwitchAuthorizeUrl({ request, state }));

    response.cookies.set(TWITCH_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    return NextResponse.redirect(buildTwitchAppUrl(request, `/login?error=${encodeURIComponent(error.message)}`));
  }
}
