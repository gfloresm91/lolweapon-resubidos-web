import { NextResponse } from "next/server";

import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";

export function middleware(request) {
  if (request.nextUrl.pathname !== "/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (validateSessionToken(token)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};

