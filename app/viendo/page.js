import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { readAnimes } from "@/lib/animeData";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WatchingRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isAdmin = validateSessionToken(token);
  const animes = await readAnimes();

  return <HomePage activeView="watching" initialLives={[]} initialAnimes={animes} isAdmin={isAdmin} />;
}

