import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { can } from "@/lib/repositories/platformUserRepository";
import { createSupportTicket, listUserSupportTickets } from "@/lib/repositories/supportTicketRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "support.tickets.view");
  if (authorization.response) return authorization.response;
  const params = new URL(request.url).searchParams;
  const result = await listUserSupportTickets({
    user: authorization.user,
    search: params.get("search") || "",
    status: params.get("status") || "all",
    type: params.get("type") || "all",
    page: params.get("page") || 1,
    pageSize: params.get("pageSize") || 10,
    sort: params.get("sort") || "lastMessageAt",
    direction: params.get("direction") || "desc",
  });
  return NextResponse.json({ success: true, ...result });
}

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "support.tickets.create");
  if (authorization.response) return authorization.response;
  if (!authorization.user?.id || !can(authorization.user, "support.tickets.create")) {
    return NextResponse.json({ success: false, error: "Inicia sesión para enviar sugerencias o reclamos." }, { status: 401 });
  }

  const payload = await readJsonRequest(request);
  if (!payload) return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });

  try {
    const ticket = await createSupportTicket({
      user: authorization.user,
      type: payload.type,
      subject: payload.subject,
      body: payload.body,
    });
    if (!ticket) {
      return NextResponse.json({ success: false, error: "Los tickets requieren DATA_SOURCE=postgres." }, { status: 503 });
    }
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo crear el ticket." }, { status: 400 });
  }
}
