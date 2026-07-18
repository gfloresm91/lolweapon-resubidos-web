import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { listAdminSupportTickets } from "@/lib/repositories/supportTicketRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administrar tickets | LOLWEAPON" };

export default async function AdminTicketsRoutePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?.id) redirect("/login");
  if (!can(currentUser, "admin.tickets.view")) notFound();
  const initialAdminSupportTicketsResult = await listAdminSupportTickets();
  return <HomePage activeView="platformTickets" initialLives={[]} initialAdminSupportTicketsResult={initialAdminSupportTicketsResult} currentUser={currentUser} accessPermissions={currentUser.permissions || []} isAdmin />;
}
