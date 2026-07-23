import { NextResponse } from "next/server";

import { clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";
import { getPlatformUserBySessionToken } from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const user = await getPlatformUserBySessionToken(token);
    if (user) {
      return NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const response = NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
    clearSessionCookie(response, request);
    return response;
  } catch {
    return NextResponse.json(
      { authenticated: false, error: "No se pudo validar la sesión." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

