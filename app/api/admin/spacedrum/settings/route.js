import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import {
  getSpaceDrumAdminSettings,
  listSpaceDrumAdminSettings,
  updateSpaceDrumAdminSettings,
} from "@/lib/repositories/spaceDrumRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.spacedrum.settings.view");
  if (authorization.response) {
    return authorization.response;
  }

  const settings = await listSpaceDrumAdminSettings();
  return NextResponse.json({ success: true, settings });
}

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.spacedrum.settings.update");
  if (authorization.response) {
    return authorization.response;
  }

  const payload = await readJsonRequest(request);
  if (!payload?.settings) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    const before = await getSpaceDrumAdminSettings(payload.settings.language);
    const savedSettings = await updateSpaceDrumAdminSettings(payload.settings);

    await createAuditLog({
      actor: authorization.user,
      action: "update",
      module: "admin.spacedrum.settings",
      entityType: "SpaceDrum",
      entityId: savedSettings.language,
      entityLabel: `SpaceDrum ${savedSettings.language}`,
      summary: "Editó configuración de SpaceDrum",
      before,
      after: savedSettings,
      request,
    });

    return NextResponse.json({
      success: true,
      settings: await listSpaceDrumAdminSettings(),
      item: savedSettings,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo guardar la configuración." },
      { status: 400 },
    );
  }
}
