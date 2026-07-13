import { NextResponse } from "next/server";

const DEFAULT_SESSION_COOKIE = "kala_admin_session";
const configuredSessionCookie = String(process.env.SESSION_COOKIE_NAME || "").trim();
const SESSION_COOKIE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(configuredSessionCookie)
  ? configuredSessionCookie
  : DEFAULT_SESSION_COOKIE;

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

  if (!["/login", "/registro"].includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/registro"],
};
