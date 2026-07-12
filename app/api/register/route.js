import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import {
  createPlatformSession,
  registerOAuthUser,
  registerManualUser,
} from "@/lib/repositories/platformUserRepository";
import { setSessionCookie } from "@/lib/auth";
import { IDENTITY_LINK_COOKIE, OAUTH_REGISTER_COOKIE, oauthCookieOptions } from "@/lib/googleOAuth";

export async function POST(request) {
  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json(
      { success: false, error: "Solicitud inválida." },
      { status: 400 },
    );
  }

  try {
    const oauthAttemptId = request.cookies.get(OAUTH_REGISTER_COOKIE)?.value;
    const user = oauthAttemptId
      ? await registerOAuthUser(payload, oauthAttemptId)
      : await registerManualUser(payload);
    const session = await createPlatformSession(user.id);
    const response = NextResponse.json({ success: true, user: session.user });

    setSessionCookie(response, request, session.token, session.expiresAt);
    response.cookies.set(OAUTH_REGISTER_COOKIE, "", oauthCookieOptions(0));
    response.cookies.set(IDENTITY_LINK_COOKIE, "", oauthCookieOptions(0));

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo registrar el usuario" },
      { status: 400 },
    );
  }
}
