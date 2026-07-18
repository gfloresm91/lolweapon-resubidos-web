import { NextResponse } from "next/server";

import { listAdminSupportTickets } from "@/lib/repositories/supportTicketRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.tickets.view");
  if (authorization.response) return authorization.response;
  const params = new URL(request.url).searchParams;
  const result = await listAdminSupportTickets({
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
