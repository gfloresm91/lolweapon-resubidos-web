import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getAnimeActivityMapForUser } from "@/lib/repositories/animeActivityRepository";
import { getAnimeLibrary } from "@/lib/repositories/animeLibraryRepository";
import { getStreamerRatingMap, getUserRatingMap } from "@/lib/repositories/animeRatingRepository";

export const dynamic = "force-dynamic";

export default async function AnimeLibraryWatchingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
  ]);

  if (!can(accessUser, "anime.tracking.view")) {
    redirect("/login");
  }

  const includeHidden = [
    "anime.tracking.update",
    "anime.tracking.delete",
    "anime.completed.update",
    "anime.completed.delete",
  ].some((permission) => can(accessUser, permission));
  const [animeLibrary, initialAnimeActivity, initialStreamerRatings, initialUserRatings] = await Promise.all([
    getAnimeLibrary({ includeHidden }),
    currentUser?.id ? getAnimeActivityMapForUser(currentUser.id) : {},
    getStreamerRatingMap(),
    currentUser?.id ? getUserRatingMap(currentUser.id) : {},
  ]);

  return (
    <HomePage
      activeView="animeLibraryTracking"
      initialLives={[]}
      initialAnimeLibrary={animeLibrary}
      initialAnimeActivity={initialAnimeActivity}
      initialStreamerRatings={initialStreamerRatings}
      initialUserRatings={initialUserRatings}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={accessUser?.permissions || []}
    />
  );
}
