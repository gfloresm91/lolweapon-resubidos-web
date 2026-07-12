import { NextResponse } from "next/server";

import { OAUTH_REGISTER_COOKIE, oauthCookieOptions } from "@/lib/googleOAuth";
import { getOAuthRegistrationAttempt } from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const attemptId = request.cookies.get(OAUTH_REGISTER_COOKIE)?.value;

  if (!attemptId) {
    return NextResponse.json(
      { success: false, error: "No hay un registro conectado pendiente." },
      { status: 404 },
    );
  }

  try {
    const registration = await getOAuthRegistrationAttempt(attemptId);
    return NextResponse.json({ success: true, registration });
  } catch (error) {
    const response = NextResponse.json(
      { success: false, error: error.message || "No se pudo cargar el registro conectado." },
      { status: 400 },
    );
    response.cookies.set(OAUTH_REGISTER_COOKIE, "", oauthCookieOptions(0));
    return response;
  }
}
