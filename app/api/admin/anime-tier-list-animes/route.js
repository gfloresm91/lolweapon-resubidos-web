import { NextResponse } from "next/server";

import { jsonError, jsonUnsupportedAction, readJsonRequest } from "@/lib/http";
import { applyAnimeTierListEntrySync, previewAnimeTierListEntrySync } from "@/lib/animeTierListEntrySync";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import {
  createAnimeTierListEntry,
  deleteAnimeTierListEntry,
  listAnimeTierListEntriesForAdmin,
  restoreAnimeTierListEntry,
  updateAnimeTierListEntry,
} from "@/lib/repositories/animeTierListEntryRepository";
import { getPrismaClient } from "@/lib/prisma";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function listSeasons() {
  const prisma = getPrismaClient();
  const rows = await prisma.animeSeason.findMany({ orderBy: [{ year: "desc" }, { season: "asc" }] });
  return rows.map((row) => ({ id: row.id, year: row.year, season: row.season, status: row.status }));
}

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.anime.tierlist.animes.view");
  if (authorization.response) return authorization.response;

  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get("seasonId");
  const seasons = await listSeasons();
  const entries = seasonId ? await listAnimeTierListEntriesForAdmin({ seasonId }) : [];
  return NextResponse.json({ success: true, seasons, entries });
}

export async function POST(request) {
  const payload = await readJsonRequest(request);
  if (!payload?.action) return jsonError("Solicitud inválida.");

  const permission = ["preview-sync", "apply-sync"].includes(payload.action)
    ? "admin.anime.tierlist.animes.sync"
    : payload.action === "create-entry"
      ? "admin.anime.tierlist.animes.create"
      : ["delete-entry", "restore-entry"].includes(payload.action)
        ? "admin.anime.tierlist.animes.delete"
        : "admin.anime.tierlist.animes.update";

  const authorization = await ensurePermissionAuthorized(request, permission);
  if (authorization.response) return authorization.response;

  try {
    if (payload.action === "preview-sync") {
      const preview = await previewAnimeTierListEntrySync(payload);
      return NextResponse.json({ success: true, preview: { selection: preview.selection, summary: preview.summary } });
    }

    if (payload.action === "apply-sync") {
      const result = await applyAnimeTierListEntrySync(payload);
      await createAuditLog({
        actor: authorization.user,
        action: "import",
        module: "admin.anime.tierlist.animes",
        entityType: "AnimeSeason",
        entityId: String(result.seasonId),
        entityLabel: `${payload.season} ${payload.year}`,
        summary: "Sincronizó el Tier List de Animes",
        after: result.summary,
        request,
      });
      return NextResponse.json({ success: true, result });
    }

    if (payload.action === "create-entry") {
      const entry = await createAnimeTierListEntry(payload);
      await createAuditLog({
        actor: authorization.user,
        action: "create",
        module: "admin.anime.tierlist.animes",
        entityType: "AnimeTierListEntry",
        entityId: String(entry.id),
        entityLabel: entry.title,
        summary: "Agregó un anime manual al Tier List",
        after: entry,
        request,
      });
      return NextResponse.json({ success: true, entry });
    }

    if (payload.action === "update-entry") {
      const entry = await updateAnimeTierListEntry(payload);
      await createAuditLog({
        actor: authorization.user,
        action: "update",
        module: "admin.anime.tierlist.animes",
        entityType: "AnimeTierListEntry",
        entityId: String(entry.id),
        entityLabel: entry.title,
        summary: "Editó un anime del Tier List",
        after: entry,
        request,
      });
      return NextResponse.json({ success: true, entry });
    }

    if (payload.action === "delete-entry") {
      const entry = await deleteAnimeTierListEntry(payload.id);
      await createAuditLog({
        actor: authorization.user,
        action: "delete",
        module: "admin.anime.tierlist.animes",
        entityType: "AnimeTierListEntry",
        entityId: String(entry.id),
        entityLabel: entry.title,
        summary: "Eliminó un anime del Tier List",
        request,
      });
      return NextResponse.json({ success: true, entry });
    }

    if (payload.action === "restore-entry") {
      const entry = await restoreAnimeTierListEntry(payload.id);
      await createAuditLog({
        actor: authorization.user,
        action: "restore",
        module: "admin.anime.tierlist.animes",
        entityType: "AnimeTierListEntry",
        entityId: String(entry.id),
        entityLabel: entry.title,
        summary: "Restauró un anime del Tier List",
        request,
      });
      return NextResponse.json({ success: true, entry });
    }

    return jsonUnsupportedAction();
  } catch (error) {
    return jsonError(error.message || "No se pudo actualizar el Tier List de Animes.");
  }
}
