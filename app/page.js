import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { readLives } from "@/lib/data";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isAdmin = validateSessionToken(token);
  const lives = await readLives();

  return <HomePage initialLives={lives} isAdmin={isAdmin} />;
}

