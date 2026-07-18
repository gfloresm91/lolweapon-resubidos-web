import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { addSupportTicketMessage } from "@/lib/repositories/supportTicketRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const authorization = await ensurePermissionAuthorized(request, "support.tickets.create");
  if (authorization.response) return authorization.response;
  const payload = await readJsonRequest(request);
  if (!payload) return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });

  try {
    const { id } = await params;
    const ticket = await addSupportTicketMessage({
      ticketId: id,
      user: authorization.user,
      body: payload.body,
      admin: false,
    });
    if (!ticket) return NextResponse.json({ success: false, error: "Ticket no encontrado." }, { status: 404 });
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo responder el ticket." }, { status: 400 });
  }
}
