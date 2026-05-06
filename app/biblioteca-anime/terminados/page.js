import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";
import { getAnimeLibrary } from "@/lib/repositories/animeLibraryRepository";

export const dynamic = "force-dynamic";

export default async function AnimeLibraryCompletedPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isAdmin = validateSessionToken(token);
  const animeLibrary = await getAnimeLibrary({ includeHidden: isAdmin });

  return (
    <HomePage
      activeView="animeLibraryCompleted"
      initialLives={[]}
      initialAnimeLibrary={animeLibrary}
      isAdmin={isAdmin}
    />
  );
}
