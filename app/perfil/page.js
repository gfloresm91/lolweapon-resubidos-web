import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import ProfileSettingsPage from "@/components/ProfileSettingsPage";
import { SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (!currentUser) {
    redirect("/login");
  }

  return <ProfileSettingsPage currentUser={currentUser} />;
}
