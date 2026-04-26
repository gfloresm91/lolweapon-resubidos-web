import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";
import { readSpaceDrum } from "@/lib/spacedrum";

export const dynamic = "force-dynamic";

export default async function SpaceDrumRoutePage() {
  if (process.env.NEXT_PUBLIC_ENABLE_SPACEDRUM !== "true") {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isAdmin = validateSessionToken(token);
  const spacedrum = await readSpaceDrum();

  return <HomePage activeView="spacedrum" initialLives={[]} initialSpaceDrum={spacedrum} isAdmin={isAdmin} />;
}
