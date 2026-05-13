import { NextResponse } from "next/server";

import {
  createPlatformSession,
  registerManualUser,
} from "@/lib/repositories/platformUserRepository";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request) {
  const payload = await request.json();

  try {
    const user = await registerManualUser(payload);
    const session = await createPlatformSession(user.id);
    const response = NextResponse.json({ success: true, user });

    response.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo registrar el usuario" },
      { status: 400 },
    );
  }
}
