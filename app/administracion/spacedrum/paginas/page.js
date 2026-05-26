import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { listSpaceDrumAdminChapters, listSpaceDrumAdminPages } from "@/lib/repositories/spaceDrumRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function PlatformSpaceDrumPagesAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (!can(currentUser, "admin.spacedrum.pages.view")) {
    redirect("/login");
  }

  const [chapters, pages] = await Promise.all([
    listSpaceDrumAdminChapters(),
    listSpaceDrumAdminPages(),
  ]);

  return (
    <HomePage
      activeView="platformSpaceDrumPages"
      initialSpaceDrumChapters={chapters}
      initialSpaceDrumPages={pages}
      isAdmin={true}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
    />
  );
}
