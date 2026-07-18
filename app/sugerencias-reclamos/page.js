import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { listUserSupportTickets } from "@/lib/repositories/supportTicketRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sugerencias/Reclamos | LOLWEAPON" };

export default async function SupportTicketsRoutePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?.id) redirect("/login");
  if (!can(currentUser, "support.tickets.view")) notFound();
  const initialSupportTicketsResult = await listUserSupportTickets({ user: currentUser });
  return <HomePage activeView="supportTickets" initialLives={[]} initialSupportTicketsResult={initialSupportTicketsResult} currentUser={currentUser} accessPermissions={currentUser.permissions || []} />;
}
