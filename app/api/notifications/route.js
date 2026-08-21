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

  const result = isFullPage ? await listUserNotifications({
    user, search: searchParams.get("search") || "", type: searchParams.get("type") || "all",
    status: searchParams.get("status") || "all", page: searchParams.get("page") || 1, pageSize: searchParams.get("pageSize") || 10,
    sort: searchParams.get("sort") || "published", direction: searchParams.get("direction") || "desc",
  }) : await listNotifications({ user: user || accessUser, limit: searchParams.get("limit") || 20 });

  return NextResponse.json({ success: true, ...result });
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
