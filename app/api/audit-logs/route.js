import { NextResponse } from "next/server";

import { listAuditLogs } from "@/lib/repositories/auditLogRepository";
import { ensureAnyPermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const AUDIT_VIEW_PERMISSIONS = [
  "users.read",
  "roles.read",
  "tracker.read",
  "tags.read",
  "admin.anime.tracking.view",
  "admin.anime.completed.view",
  "admin.anime.calendar.view",
  "admin.notifications.view",
];

export async function GET(request) {
  const authorization = await ensureAnyPermissionAuthorized(request, AUDIT_VIEW_PERMISSIONS);
  if (authorization.response) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const logs = await listAuditLogs({
    module: searchParams.get("module") || "",
    entityType: searchParams.get("entityType") || "",
    entityId: searchParams.get("entityId") || "",
    action: searchParams.get("action") || "",
    limit: searchParams.get("limit") || 80,
  });

  return NextResponse.json({ success: true, logs });
}
