import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { createStreamOnlineSubscription } from "@/lib/twitch";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "tracker.update");

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const subscription = await createStreamOnlineSubscription();
    await createAuditLog({
      actor: authorization.user,
      action: "eventsub_subscribe",
      module: "admin.tracker",
      entityType: "TwitchEventSub",
      entityId: subscription?.id || process.env.TWITCH_BROADCASTER_LOGIN || "stream.online",
      entityLabel: process.env.TWITCH_BROADCASTER_LOGIN || "stream.online",
      summary: "Registró EventSub de Twitch",
      after: subscription,
      request,
    });

    return NextResponse.json({ success: true, subscription });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}
