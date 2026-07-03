import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { createPlatformNotification } from "@/lib/repositories/notificationRepository";
import { readSpaceDrumLibrary } from "@/lib/repositories/spaceDrumRepository";
import { getSpaceDrumImportSummary, importRemoteSpaceDrum } from "@/lib/spacedrumRemoteImport";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.spacedrum.import.view");
  if (authorization.response) {
    return authorization.response;
  }

  const summary = getSpaceDrumImportSummary(await readSpaceDrumLibrary());
  return NextResponse.json({ success: true, summary });
}

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.spacedrum.import.run");
  if (authorization.response) {
    return authorization.response;
  }

  const payload = await readJsonRequest(request);
  if (!payload || payload.action !== "remote-import") {
    return NextResponse.json({ success: false, error: "Acción no soportada." }, { status: 400 });
  }

  try {
    const before = getSpaceDrumImportSummary(await readSpaceDrumLibrary());
    const result = await importRemoteSpaceDrum({ writeJson: false });

    await createAuditLog({
      actor: authorization.user,
      action: "import",
      module: "admin.spacedrum.import",
      entityType: "SpaceDrum",
      entityId: "remote",
      entityLabel: "Importación remota",
      summary: "Importó SpaceDrum desde la web original",
      before,
      after: result.summary,
      request,
    });
    await createPlatformNotification({
      type: "system",
      severity: "success",
      source: "spacedrum",
      title: "SpaceDrum importado",
      body: "La importación remota terminó correctamente.",
      href: "/administracion/spacedrum/importacion",
      icon: "BookOpen",
      audience: "permission:admin.spacedrum.import.view",
      actor: authorization.user,
      metadata: { summary: result.summary },
    });

    return NextResponse.json({ success: true, summary: result.summary });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo importar SpaceDrum." }, { status: 400 });
  }
}
