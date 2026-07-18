import { NextResponse } from "next/server";

import { getSupportTicket } from "@/lib/repositories/supportTicketRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const authorization = await ensurePermissionAuthorized(request, "support.tickets.view");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  const ticket = await getSupportTicket({ ticketId: id, user: authorization.user });
  if (!ticket) {
    return NextResponse.json({ success: false, error: "Ticket no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ success: true, ticket });
}
