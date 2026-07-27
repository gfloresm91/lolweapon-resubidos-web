import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { ensureStreamSubscriptions } from "@/lib/twitch";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "tracker.update");

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const result = await ensureStreamSubscriptions();

    if (result.alreadyActive) {
      return NextResponse.json({
        success: true,
        alreadyActive: true,
        subscriptions: result.subscriptions,
      });
    }

    await createAuditLog({
      actor: authorization.user,
      action: "eventsub_subscribe",
      module: "admin.tracker",
      entityType: "TwitchEventSub",
      entityId: result.subscriptions?.online?.id || process.env.TWITCH_BROADCASTER_LOGIN || "stream.online",
      entityLabel: process.env.TWITCH_BROADCASTER_LOGIN || "stream.online/offline",
      summary: result.removed
        ? "Reemplazó una suscripción EventSub inactiva de Twitch"
        : "Registró EventSub de Twitch",
      after: { subscriptions: result.subscriptions, removedInactiveSubscriptions: result.removed },
      request,
    });

    return NextResponse.json({
      success: true,
      subscriptions: result.subscriptions,
      replacedInactive: result.removed,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}
