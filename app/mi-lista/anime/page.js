import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { getAnimeActivityMapForUser } from "@/lib/repositories/animeActivityRepository";
import { getAnimeLibrary } from "@/lib/repositories/animeLibraryRepository";
import { getStreamerRatingMap, getUserRatingMap } from "@/lib/repositories/animeRatingRepository";
import { can } from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

export default async function MyAnimeListPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
  ]);

  if (!currentUser) {
    redirect("/login");
  }

  if (!can(accessUser, "anime.tracking.view") && !can(accessUser, "anime.completed.view")) {
    redirect("/login");
  }

  const [animeLibrary, initialAnimeActivity, initialStreamerRatings, initialUserRatings] = await Promise.all([
    getAnimeLibrary({ includeHidden: false }),
    getAnimeActivityMapForUser(currentUser.id),
    getStreamerRatingMap(),
    getUserRatingMap(currentUser.id),
  ]);

  return (
    <HomePage
      activeView="myAnimeList"
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
