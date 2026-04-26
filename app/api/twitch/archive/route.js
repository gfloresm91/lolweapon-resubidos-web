import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";
import { upsertTwitchLive } from "@/lib/twitchArchive";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
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

    return NextResponse.json({ success: true, live });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}
