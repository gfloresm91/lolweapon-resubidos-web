import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { withPublicAccessPermissions } from "@/lib/publicAccessPolicy";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getAnimeActivityMapForUser } from "@/lib/repositories/animeActivityRepository";
import { getAnimeLibrary } from "@/lib/repositories/animeLibraryRepository";
import { getStreamerRatingMap, getUserRatingMap } from "@/lib/repositories/animeRatingRepository";

export const dynamic = "force-dynamic";

export default async function AnimeLibraryCompletedPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, isAdmin] = await Promise.all([
    getCurrentUserFromToken(token),
    validateAdminSessionToken(token),
  ]);

  const includeHidden = [
    "anime.tracking.update",
    "anime.tracking.delete",
    "anime.completed.update",
    "anime.completed.delete",
  ].some((permission) => can(currentUser, permission));
  const [animeLibrary, initialAnimeActivity, initialStreamerRatings, initialUserRatings] = await Promise.all([
    getAnimeLibrary({ includeHidden }),
    currentUser?.id ? getAnimeActivityMapForUser(currentUser.id) : {},
    getStreamerRatingMap(),
    currentUser?.id ? getUserRatingMap(currentUser.id) : {},
  ]);

  return (
    <HomePage
      activeView="animeLibraryCompleted"
      initialLives={[]}
      initialAnimeLibrary={animeLibrary}
      initialAnimeActivity={initialAnimeActivity}
      initialStreamerRatings={initialStreamerRatings}
      initialUserRatings={initialUserRatings}
      isAdmin={isAdmin}
      currentUser={currentUser}
      accessPermissions={withPublicAccessPermissions(currentUser?.permissions)}
    />
  );
}
