import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isAdmin = validateSessionToken(token);
  const [lives, liveStatuses] = await Promise.all([
    readLives(),
    getLiveStatuses(),
  ]);

  return <HomePage activeView="tracker" initialLives={lives} initialLiveStatuses={liveStatuses} isAdmin={isAdmin} />;
}
