import { NextResponse } from "next/server";

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
    return NextResponse.json({ success: true, subscription });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}
