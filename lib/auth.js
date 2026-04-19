import { NextResponse } from "next/server";

export const SESSION_COOKIE = "kala_admin_session";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "kaladmin";
export const SESSION_TOKEN =
  process.env.ADMIN_SESSION_TOKEN || "change-me-in-env-for-production";

export function validateSessionToken(token) {
  return Boolean(token && token === SESSION_TOKEN);
}

export async function ensureAuthorized(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!validateSessionToken(token)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  return null;
}

