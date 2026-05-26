import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import {
  deleteSpaceDrumAdminPage,
  getSpaceDrumAdminPage,
  listSpaceDrumAdminChapters,
  listSpaceDrumAdminPages,
  upsertSpaceDrumAdminPage,
} from "@/lib/repositories/spaceDrumRepository";
import { ensureAnyPermissionAuthorized, ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const WRITE_PERMISSIONS = [
  "admin.spacedrum.pages.create",
  "admin.spacedrum.pages.update",
  "admin.spacedrum.pages.delete",
];

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.spacedrum.pages.view");
  if (authorization.response) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const chapterId = searchParams.get("chapterId");
  const [chapters, pages] = await Promise.all([
    listSpaceDrumAdminChapters(),
    listSpaceDrumAdminPages({ chapterId }),
  ]);
  return NextResponse.json({ success: true, chapters, pages });
}

export async function POST(request) {
  const authorization = await ensureAnyPermissionAuthorized(request, WRITE_PERMISSIONS);
  if (authorization.response) {
    return authorization.response;
  }

  const payload = await readJsonRequest(request);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    if ((payload.action === "create" || payload.action === "update") && payload.page) {
      const requiredPermission = payload.action === "create"
        ? "admin.spacedrum.pages.create"
        : "admin.spacedrum.pages.update";
      const permissionCheck = await ensurePermissionAuthorized(request, requiredPermission);
      if (permissionCheck.response) {
        return permissionCheck.response;
      }

      const before = payload.page?.id ? await getSpaceDrumAdminPage(payload.page.id) : null;
      const savedPage = await upsertSpaceDrumAdminPage(payload.page);

      await createAuditLog({
        actor: authorization.user,
        action: payload.action,
        module: "admin.spacedrum.pages",
        entityType: "SpaceDrumPage",
        entityId: savedPage.id,
        entityLabel: `${savedPage.chapterTitle} · Página ${savedPage.position + 1}`,
        summary: payload.action === "create" ? "Creó página SpaceDrum" : "Editó página SpaceDrum",
        before,
        after: savedPage,
        request,
      });

      return NextResponse.json({ success: true, pages: await listSpaceDrumAdminPages(), page: savedPage });
    }

    if (payload.action === "delete" && payload.id) {
      const permissionCheck = await ensurePermissionAuthorized(request, "admin.spacedrum.pages.delete");
      if (permissionCheck.response) {
        return permissionCheck.response;
      }

      const deletedPage = await deleteSpaceDrumAdminPage(payload.id);

      await createAuditLog({
        actor: authorization.user,
        action: "delete",
        module: "admin.spacedrum.pages",
        entityType: "SpaceDrumPage",
        entityId: payload.id,
        entityLabel: deletedPage ? `${deletedPage.chapterTitle} · Página ${deletedPage.position + 1}` : payload.id,
        summary: "Eliminó página SpaceDrum",
        before: deletedPage,
        after: null,
        request,
      });

      return NextResponse.json({ success: true, pages: await listSpaceDrumAdminPages() });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo procesar la solicitud." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: false, error: "Acción no soportada." }, { status: 400 });
}
