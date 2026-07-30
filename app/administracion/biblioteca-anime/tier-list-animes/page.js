import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function PlatformAnimeTierListAnimesRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (!can(currentUser, "admin.anime.tierlist.animes.view")) redirect("/login");
  return <HomePage activeView="platformAnimeTierListAnimes" isAdmin currentUser={currentUser} accessPermissions={currentUser?.permissions || []} />;
}
