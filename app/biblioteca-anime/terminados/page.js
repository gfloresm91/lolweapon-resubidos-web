import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getAnimeActivityMapForUser } from "@/lib/repositories/animeActivityRepository";
import { getAnimeLibrary } from "@/lib/repositories/animeLibraryRepository";

export const dynamic = "force-dynamic";

export default async function AnimeLibraryCompletedPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
  ]);

  if (!can(accessUser, "anime.completed.view")) {
    redirect("/login");
  }

  const includeHidden = [
    "anime.tracking.update",
    "anime.tracking.delete",
    "anime.completed.update",
    "anime.completed.delete",
  ].some((permission) => can(accessUser, permission));
  const [animeLibrary, initialAnimeActivity] = await Promise.all([
    getAnimeLibrary({ includeHidden }),
    currentUser?.id ? getAnimeActivityMapForUser(currentUser.id) : {},
  ]);

  return (
    <HomePage
      activeView="animeLibraryCompleted"
      initialLives={[]}
      initialAnimeLibrary={animeLibrary}
      initialAnimeActivity={initialAnimeActivity}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={accessUser?.permissions || []}
    />
  );
}
