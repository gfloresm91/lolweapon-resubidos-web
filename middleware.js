import { NextResponse } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ORIGIN_EXEMPT_PATHS = new Set(["/api/twitch/eventsub"]);

function getRequestOrigin(request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");

  return host ? `${protocol}://${host}` : null;
}

function hasValidMutationOrigin(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin) {
    return fetchSite !== "cross-site";
  }

  const expectedOrigin = getRequestOrigin(request);
  if (!expectedOrigin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

export function middleware(request) {
  if (
    request.nextUrl.pathname.startsWith("/api/")
    && UNSAFE_METHODS.has(request.method)
    && !ORIGIN_EXEMPT_PATHS.has(request.nextUrl.pathname)
    && !hasValidMutationOrigin(request)
  ) {
    return NextResponse.json(
      { success: false, error: "Origen de solicitud no autorizado" },
      { status: 403 },
    );
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
