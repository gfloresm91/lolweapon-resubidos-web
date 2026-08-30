import { cookies } from "next/headers";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { withPublicAccessPermissions } from "@/lib/publicAccessPolicy";
import { getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function AnimeTierListOpeningsRoutePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, isAdmin] = await Promise.all([
    getCurrentUserFromToken(token),
    validateAdminSessionToken(token),
  ]);

  return <HomePage activeView="animeTierListOpenings" isAdmin={isAdmin} currentUser={currentUser} accessPermissions={withPublicAccessPermissions(currentUser?.permissions)} />;
}
