import { NextResponse } from "next/server";

import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";

export function middleware(request) {
  const hostname = request.headers.get("host")?.split(":")[0] || "";
  const resubidosHost = process.env.RESUBIDOS_HOST || "resubidos.lolweapon.com";
  const viendoHost = process.env.VIENDO_HOST || "viendo.lolweapon.com";

  if (request.nextUrl.pathname === "/") {
    if (hostname === resubidosHost) {
      return NextResponse.rewrite(new URL("/rastreador", request.url));
    }

    if (hostname === viendoHost) {
      return NextResponse.rewrite(new URL("/biblioteca-anime/viendo", request.url));
    }
  }

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
  matcher: ["/", "/login"],
};
