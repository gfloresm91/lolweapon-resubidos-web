import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";
import { getLiveStatuses } from "@/lib/repositories/liveRepository";
import { readSpaceDrum } from "@/lib/repositories/spaceDrumRepository";

export const dynamic = "force-dynamic";

export default async function SpaceDrumRoutePage() {
  if (process.env.NEXT_PUBLIC_ENABLE_SPACEDRUM !== "true") {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isAdmin = validateSessionToken(token);
  const [spacedrum, liveStatuses] = await Promise.all([
    readSpaceDrum(),
    getLiveStatuses(),
  ]);

  return <HomePage activeView="spacedrum" initialLives={[]} initialLiveStatuses={liveStatuses} initialSpaceDrum={spacedrum} isAdmin={isAdmin} />;
}
