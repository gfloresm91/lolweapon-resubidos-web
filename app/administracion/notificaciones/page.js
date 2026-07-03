import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { listAdminNotifications } from "@/lib/repositories/notificationRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administrar notificaciones | LOLWEAPON" };

export default async function AdminNotificationsRoutePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?.id) redirect("/login");
  if (!can(currentUser, "admin.notifications.view")) notFound();
  const initialAdminNotificationsResult = await listAdminNotifications();
  return <HomePage activeView="platformNotifications" initialLives={[]} initialAdminNotificationsResult={initialAdminNotificationsResult} currentUser={currentUser} accessPermissions={currentUser.permissions || []} isAdmin />;
}
