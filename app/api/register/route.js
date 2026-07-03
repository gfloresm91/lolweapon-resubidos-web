import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import {
  createPlatformSession,
  registerManualUser,
} from "@/lib/repositories/platformUserRepository";
import { setSessionCookie } from "@/lib/auth";

export async function POST(request) {
  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json(
      { success: false, error: "Solicitud inválida." },
      { status: 400 },
    );
  }

  try {
    const user = await registerManualUser(payload);
    const session = await createPlatformSession(user.id);
    const response = NextResponse.json({ success: true, user: session.user });

    setSessionCookie(response, request, session.token, session.expiresAt);

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo registrar el usuario" },
      { status: 400 },
    );
  }
}
