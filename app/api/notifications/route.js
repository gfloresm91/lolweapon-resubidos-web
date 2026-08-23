import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import {
  dismissNotification,
  listNotifications, listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  restoreNotification,
} from "@/lib/repositories/notificationRepository";
import { getAccessUserFromToken, getCurrentUserFromToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

const PUBLIC_CACHE_CONTROL = "public, max-age=5, s-maxage=10, stale-while-revalidate=30";
const PUBLIC_RESULT_TTL_MS = 10 * 1000;
const globalForPublicNotifications = globalThis;

if (!globalForPublicNotifications.__lolweaponPublicNotifications) {
  globalForPublicNotifications.__lolweaponPublicNotifications = new Map();
}

const publicNotificationCache = globalForPublicNotifications.__lolweaponPublicNotifications;

function listPublicNotifications({ user, limit }) {
  const cacheKey = String(limit || 20);
  const cached = publicNotificationCache.get(cacheKey);

  if (cached?.result && Date.now() - cached.updatedAt <= PUBLIC_RESULT_TTL_MS) {
    return Promise.resolve(cached.result);
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = listNotifications({ user, limit })
    .then((result) => {
      publicNotificationCache.set(cacheKey, { result, updatedAt: Date.now(), promise: null });
      return result;
    })
    .catch((error) => {
      publicNotificationCache.delete(cacheKey);
      throw error;
    });

  publicNotificationCache.set(cacheKey, { result: cached?.result || null, updatedAt: cached?.updatedAt || 0, promise });
  return promise;
}

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);
  const accessUser = user || await getAccessUserFromToken(null);
  const { searchParams } = new URL(request.url);
  const isFullPage = searchParams.has("page") || searchParams.has("status") || searchParams.has("search") || searchParams.has("type");

  if (isFullPage && (!user?.id || !can(user, "notifications.full.view"))) {
    return NextResponse.json({ success: false, error: user ? "Permiso insuficiente" : "No autorizado" }, { status: user ? 403 : 401 });
  }

  if (!isFullPage && !can(accessUser, "notifications.view")) {
    return NextResponse.json({ success: false, error: "Permiso insuficiente" }, { status: 403 });
  }

  const isPublicRequest = !user?.id && !isFullPage && searchParams.get("scope") === "public";
  const result = isFullPage ? await listUserNotifications({
    user, search: searchParams.get("search") || "", type: searchParams.get("type") || "all",
    status: searchParams.get("status") || "all", page: searchParams.get("page") || 1, pageSize: searchParams.get("pageSize") || 10,
    sort: searchParams.get("sort") || "published", direction: searchParams.get("direction") || "desc",
  }) : isPublicRequest
    ? await listPublicNotifications({ user: accessUser, limit: searchParams.get("limit") || 20 })
    : await listNotifications({ user: user || accessUser, limit: searchParams.get("limit") || 20 });

  const response = NextResponse.json({ success: true, ...result });

  if (isPublicRequest) {
    response.headers.set("Cache-Control", PUBLIC_CACHE_CONTROL);
    response.headers.set("Cloudflare-CDN-Cache-Control", PUBLIC_CACHE_CONTROL);
  } else {
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);

  if (!user?.id || (!can(user, "notifications.view") && !can(user, "notifications.full.view"))) {
    return NextResponse.json({ success: false, error: "Inicia sesión para gestionar notificaciones." }, { status: 401 });
  }

  let payload = null;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Payload inválido." }, { status: 400 });
  }

  if (payload?.action === "mark-read") {
    await markNotificationRead({ user, notificationId: payload.id });
    const result = await listNotifications({ user });
    return NextResponse.json({ success: true, ...result });
  }

  if (payload?.action === "mark-unread") {
    await markNotificationUnread({ user, notificationId: payload.id });
    return NextResponse.json({ success: true });
  }

  if (payload?.action === "mark-all-read") {
    await markAllNotificationsRead({ user });
    const result = await listNotifications({ user });
    return NextResponse.json({ success: true, ...result });
  }

  if (payload?.action === "dismiss") {
    await dismissNotification({ user, notificationId: payload.id });
    const result = await listNotifications({ user });
    return NextResponse.json({ success: true, ...result });
  }

  if (payload?.action === "restore") {
    await restoreNotification({ user, notificationId: payload.id });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Acción no soportada." }, { status: 400 });
}
