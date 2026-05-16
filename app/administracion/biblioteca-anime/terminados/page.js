import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAnimeLibrary } from "@/lib/repositories/animeLibraryRepository";
import { canAny } from "@/lib/repositories/platformUserRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const COMPLETED_MANAGEMENT_PERMISSIONS = [
  "anime.completed.create",
  "anime.completed.update",
  "anime.completed.delete",
];
const COMPLETED_SCREEN_PERMISSION = "admin.anime.completed.view";

export default async function PlatformAnimeCompletedAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (
    !canAny(currentUser, [COMPLETED_SCREEN_PERMISSION])
    || !canAny(currentUser, COMPLETED_MANAGEMENT_PERMISSIONS)
  ) {
    redirect("/login");
  }

  const animeLibrary = await getAnimeLibrary({ includeHidden: true });

  return (
    <HomePage
      activeView="platformAnimeCompleted"
      initialLives={[]}
      initialAnimeLibrary={animeLibrary}
      isAdmin={true}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
    />
  );
}
