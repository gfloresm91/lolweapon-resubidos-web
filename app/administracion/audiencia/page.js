import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getHomePresenceCount } from "@/lib/pagePresence";
import { can } from "@/lib/repositories/platformUserRepository";
import { getStreamAudienceDashboard } from "@/lib/repositories/streamAudienceRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audiencia web | LOLWEAPON" };

export default async function AdminAudienceRoutePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?.id) redirect("/login");
  if (!can(currentUser, "admin.audience.view")) notFound();

  const initialAudienceResult = await getStreamAudienceDashboard();
  return (
    <HomePage
      activeView="platformAudience"
      initialLives={[]}
      initialAudienceResult={{ ...initialAudienceResult, currentCount: getHomePresenceCount() }}
      currentUser={currentUser}
      accessPermissions={currentUser.permissions || []}
      isAdmin
    />
  );
}
