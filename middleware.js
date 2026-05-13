import { NextResponse } from "next/server";

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login"],
};
