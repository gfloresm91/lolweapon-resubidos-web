import { NextResponse } from "next/server";

import { clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";
import { deletePlatformSession } from "@/lib/repositories/platformUserRepository";

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  await deletePlatformSession(token);

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response, request);
  return response;
}
