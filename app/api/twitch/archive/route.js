import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { upsertTwitchLive } from "@/lib/twitchArchive";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "tracker.create");

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const live = await upsertTwitchLive({
      broadcaster_user_login: process.env.TWITCH_BROADCASTER_LOGIN,
    });

    if (!live) {
      return NextResponse.json(
        { success: false, error: "El canal no está online en Twitch." },
        { status: 404 },
      );
    }

    await createAuditLog({
      actor: authorization.user,
      action: "twitch_archive",
      module: "admin.tracker",
      entityType: "Live",
      entityId: live.dbId || live.id,
      entityLabel: live.title || live.id,
      summary: "Creó directo desde Twitch",
      after: live,
      request,
    });

    const [lives, statuses] = await Promise.all([
      readLives(),
      getLiveStatuses(),
    ]);

    return NextResponse.json({ success: true, live, lives, statuses });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}
