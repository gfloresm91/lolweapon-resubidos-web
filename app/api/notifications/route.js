import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import {
  dismissNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/repositories/notificationRepository";
import { getAccessUserFromToken, getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getAccessUserFromToken(token);
  const { searchParams } = new URL(request.url);
  const result = await listNotifications({
    user,
    limit: searchParams.get("limit") || 20,
  });

  return NextResponse.json({ success: true, ...result });
}

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);

  if (!user?.id) {
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

  return NextResponse.json({ success: false, error: "Acción no soportada." }, { status: 400 });
}
