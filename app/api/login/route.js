import { NextResponse } from "next/server";

import { ADMIN_PASSWORD, SESSION_COOKIE, SESSION_TOKEN } from "@/lib/auth";

export async function POST(request) {
  const { password } = await request.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { success: false, error: "Contraseña incorrecta" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, SESSION_TOKEN, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}

