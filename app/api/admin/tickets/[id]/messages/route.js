import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { addSupportTicketMessage, getSupportTicket } from "@/lib/repositories/supportTicketRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const authorization = await ensurePermissionAuthorized(request, "admin.tickets.update");
  if (authorization.response) return authorization.response;
  const payload = await readJsonRequest(request);
  if (!payload) return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });

  try {
    const { id } = await params;
    const before = await getSupportTicket({ ticketId: id, admin: true });
    const ticket = await addSupportTicketMessage({
      ticketId: id,
      user: authorization.user,
      body: payload.body,
      admin: true,
    });
    if (!ticket) return NextResponse.json({ success: false, error: "Ticket no encontrado." }, { status: 404 });
    await createAuditLog({
      actor: authorization.user,
      action: "reply",
      module: "admin.tickets",
      entityType: "SupportTicket",
      entityId: ticket.id,
      entityLabel: ticket.subject,
      summary: "Respondió ticket",
      before,
      after: ticket,
      request,
    });
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo responder el ticket." }, { status: 400 });
  }
}
