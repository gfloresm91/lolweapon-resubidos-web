import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { ensureStreamOnlineSubscription } from "@/lib/twitch";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "tracker.update");

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const result = await ensureStreamOnlineSubscription();

    if (result.alreadyActive) {
      return NextResponse.json({
        success: true,
        alreadyActive: true,
        subscription: result.subscription,
      });
    }

    await createAuditLog({
      actor: authorization.user,
      action: "eventsub_subscribe",
      module: "admin.tracker",
      entityType: "TwitchEventSub",
      entityId: result.subscription?.id || process.env.TWITCH_BROADCASTER_LOGIN || "stream.online",
      entityLabel: process.env.TWITCH_BROADCASTER_LOGIN || "stream.online",
      summary: result.removed
        ? "Reemplazó una suscripción EventSub inactiva de Twitch"
        : "Registró EventSub de Twitch",
      after: { subscription: result.subscription, removedInactiveSubscriptions: result.removed },
      request,
    });

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      replacedInactive: result.removed,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}
