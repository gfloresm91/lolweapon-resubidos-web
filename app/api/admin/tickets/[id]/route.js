import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { getSupportTicket, updateSupportTicketStatus } from "@/lib/repositories/supportTicketRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const authorization = await ensurePermissionAuthorized(request, "admin.tickets.view");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  const ticket = await getSupportTicket({ ticketId: id, admin: true });
  if (!ticket) return NextResponse.json({ success: false, error: "Ticket no encontrado." }, { status: 404 });
  return NextResponse.json({ success: true, ticket });
}

export async function PATCH(request, { params }) {
  const authorization = await ensurePermissionAuthorized(request, "admin.tickets.update");
  if (authorization.response) return authorization.response;
  const payload = await readJsonRequest(request);
  if (!payload) return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });

  try {
    const { id } = await params;
    const before = await getSupportTicket({ ticketId: id, admin: true });
    const ticket = await updateSupportTicketStatus({ ticketId: id, status: payload.status, actor: authorization.user });
    if (!ticket) return NextResponse.json({ success: false, error: "Ticket no encontrado." }, { status: 404 });
    await createAuditLog({
      actor: authorization.user,
      action: "update-status",
      module: "admin.tickets",
      entityType: "SupportTicket",
      entityId: ticket.id,
      entityLabel: ticket.subject,
      summary: `Cambió estado de ticket a ${ticket.status}`,
      before,
      after: ticket,
      request,
    });
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo actualizar el ticket." }, { status: 400 });
  }
}
