import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { listSpaceDrumAdminChapters } from "@/lib/repositories/spaceDrumRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function PlatformSpaceDrumChaptersAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (!can(currentUser, "admin.spacedrum.chapters.view")) {
    redirect("/login");
  }

  const chapters = await listSpaceDrumAdminChapters();

  return (
    <HomePage
      activeView="platformSpaceDrumChapters"
      initialSpaceDrumChapters={chapters}
      isAdmin={true}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
    />
  );
}
