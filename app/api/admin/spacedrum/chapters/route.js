import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import {
  deleteSpaceDrumAdminChapter,
  getSpaceDrumAdminChapter,
  listSpaceDrumAdminChapters,
  updateSpaceDrumAdminChapterStatus,
  upsertSpaceDrumAdminChapter,
} from "@/lib/repositories/spaceDrumRepository";
import { ensureAnyPermissionAuthorized, ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const WRITE_PERMISSIONS = [
  "admin.spacedrum.chapters.create",
  "admin.spacedrum.chapters.update",
  "admin.spacedrum.chapters.delete",
];

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.spacedrum.chapters.view");
  if (authorization.response) {
    return authorization.response;
  }

  const chapters = await listSpaceDrumAdminChapters();
  return NextResponse.json({ success: true, chapters });
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
    if ((payload.action === "create" || payload.action === "update") && payload.chapter) {
      const requiredPermission = payload.action === "create"
        ? "admin.spacedrum.chapters.create"
        : "admin.spacedrum.chapters.update";
      const permissionCheck = await ensurePermissionAuthorized(request, requiredPermission);
      if (permissionCheck.response) {
        return permissionCheck.response;
      }

      const before = payload.chapter?.id ? await getSpaceDrumAdminChapter(payload.chapter.id) : null;
      const savedChapter = await upsertSpaceDrumAdminChapter(payload.chapter);

      await createAuditLog({
        actor: authorization.user,
        action: payload.action,
        module: "admin.spacedrum.chapters",
        entityType: "SpaceDrumChapter",
        entityId: savedChapter.id,
        entityLabel: savedChapter.title,
        summary: payload.action === "create" ? "Creó capítulo SpaceDrum" : "Editó capítulo SpaceDrum",
        before,
        after: savedChapter,
        request,
      });

      return NextResponse.json({ success: true, chapters: await listSpaceDrumAdminChapters(), chapter: savedChapter });
    }

    if (payload.action === "update-status" && payload.id) {
      const permissionCheck = await ensurePermissionAuthorized(request, "admin.spacedrum.chapters.update");
      if (permissionCheck.response) {
        return permissionCheck.response;
      }

      const before = await getSpaceDrumAdminChapter(payload.id);
      const savedChapter = await updateSpaceDrumAdminChapterStatus(payload.id, payload.status);

      await createAuditLog({
        actor: authorization.user,
        action: "status_change",
        module: "admin.spacedrum.chapters",
        entityType: "SpaceDrumChapter",
        entityId: savedChapter.id,
        entityLabel: savedChapter.title,
        summary: "Cambió estado de capítulo SpaceDrum",
        before,
        after: savedChapter,
        request,
      });

      return NextResponse.json({ success: true, chapters: await listSpaceDrumAdminChapters(), chapter: savedChapter });
    }

    if (payload.action === "delete" && payload.id) {
      const permissionCheck = await ensurePermissionAuthorized(request, "admin.spacedrum.chapters.delete");
      if (permissionCheck.response) {
        return permissionCheck.response;
      }

      const deletedChapter = await deleteSpaceDrumAdminChapter(payload.id);

      await createAuditLog({
        actor: authorization.user,
        action: "delete",
        module: "admin.spacedrum.chapters",
        entityType: "SpaceDrumChapter",
        entityId: payload.id,
        entityLabel: deletedChapter?.title || payload.id,
        summary: "Eliminó capítulo SpaceDrum",
        before: deletedChapter,
        after: null,
        request,
      });

      return NextResponse.json({ success: true, chapters: await listSpaceDrumAdminChapters() });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo procesar la solicitud." }, { status: 400 });
  }

  return NextResponse.json({ success: false, error: "Acción no soportada." }, { status: 400 });
}
