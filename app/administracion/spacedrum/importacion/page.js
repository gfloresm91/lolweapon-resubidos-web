import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { readSpaceDrumLibrary } from "@/lib/repositories/spaceDrumRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";
import { getSpaceDrumImportSummary } from "@/lib/spacedrumRemoteImport";

export const dynamic = "force-dynamic";

export default async function PlatformSpaceDrumImportAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (!can(currentUser, "admin.spacedrum.import.view")) {
    redirect("/login");
  }

  const summary = getSpaceDrumImportSummary(await readSpaceDrumLibrary());

  return (
    <HomePage
      activeView="platformSpaceDrumImport"
      initialSpaceDrumImportSummary={summary}
      isAdmin={true}
      currentUser={currentUser}
      accessPermissions={currentUser?.permissions || []}
    />
  );
}
