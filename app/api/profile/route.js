import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { readJsonRequest } from "@/lib/http";
import { getCurrentUserFromToken } from "@/lib/serverAuth";
import {
  disconnectOAuthIdentity,
  updateCurrentUserPassword,
  updateCurrentUserProfile,
} from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json({ success: true, user });
}

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    if (payload?.action === "profile") {
      const savedUser = await updateCurrentUserProfile(payload.profile, { user });
      return NextResponse.json({ success: true, user: savedUser });
    }

    if (payload?.action === "password") {
      const savedUser = await updateCurrentUserPassword(payload.password, { user });
      return NextResponse.json({ success: true, user: savedUser });
    }

    if (payload?.action === "identity-disconnect") {
      const savedUser = await disconnectOAuthIdentity(user.id, payload.provider);
      return NextResponse.json({ success: true, user: savedUser });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json(
    { success: false, error: "Acción no soportada" },
    { status: 400 },
  );
}
