import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";
import { createStreamOnlineSubscription } from "@/lib/twitch";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
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

