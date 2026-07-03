import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { listUserNotifications } from "@/lib/repositories/notificationRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notificaciones | LOLWEAPON" };

export default async function NotificationsRoutePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?.id) redirect("/login");
  if (!can(currentUser, "notifications.full.view")) notFound();
  const initialNotificationsResult = await listUserNotifications({ user: currentUser });
  return <HomePage activeView="notifications" initialLives={[]} initialNotificationsResult={initialNotificationsResult} currentUser={currentUser} accessPermissions={currentUser.permissions || []} />;
}
