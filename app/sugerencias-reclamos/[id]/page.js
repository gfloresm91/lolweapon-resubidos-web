import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import HomePage from "@/components/HomePage";
import { SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getSupportTicket } from "@/lib/repositories/supportTicketRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket | LOLWEAPON" };

export default async function SupportTicketThreadRoutePage({ params }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?.id) redirect("/login");
  if (!can(currentUser, "support.tickets.view")) notFound();
  const { id } = await params;
  const initialSupportTicket = await getSupportTicket({ ticketId: id, user: currentUser });
  if (!initialSupportTicket) notFound();
  return <HomePage activeView="supportTicketThread" initialLives={[]} initialSupportTicket={initialSupportTicket} currentUser={currentUser} accessPermissions={currentUser.permissions || []} />;
}
