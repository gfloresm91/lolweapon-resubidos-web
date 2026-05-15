import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAnimeLibrary } from "@/lib/repositories/animeLibraryRepository";
import { canAny } from "@/lib/repositories/platformUserRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const TRACKING_MANAGEMENT_PERMISSIONS = [
  "anime.tracking.create",
  "anime.tracking.update",
  "anime.tracking.delete",
];
const TRACKING_SCREEN_PERMISSION = "admin.anime.tracking.view";
const ADMIN_ROLE_CODES = new Set(["dios", "admin"]);

export default async function PlatformAnimeTrackingAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (
    !ADMIN_ROLE_CODES.has(currentUser?.role)
    || !canAny(currentUser, [TRACKING_SCREEN_PERMISSION])
    || !canAny(currentUser, TRACKING_MANAGEMENT_PERMISSIONS)
  ) {
    redirect("/login");
  }

  const animeLibrary = await getAnimeLibrary({ includeHidden: true });

  return (
    <HomePage
      activeView="platformAnimeTracking"
      initialLives={[]}
      initialAnimeLibrary={animeLibrary}
      isAdmin={true}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
    />
  );
}
