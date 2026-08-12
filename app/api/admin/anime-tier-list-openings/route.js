import { NextResponse } from "next/server";

import { jsonError, jsonUnsupportedAction, readJsonRequest } from "@/lib/http";
import { applyAnimeTierListThemeSync, previewAnimeTierListThemeSync } from "@/lib/animeTierListThemeSync";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import {
  createAnimeTierListTheme,
  deleteAnimeTierListTheme,
  listAnimeTierListThemesForAdmin,
  restoreAnimeTierListTheme,
  updateAnimeTierListTheme,
} from "@/lib/repositories/animeTierListThemeRepository";
import { relinkAnimeTierListEntry } from "@/lib/repositories/animeTierListEntryRepository";
import { SEASON_LABELS } from "@/lib/animeTierListLabels";
import { getPrismaClient } from "@/lib/prisma";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

// Orden cronológico de trimestres (no alfabético): define el orden de las claves de SEASON_LABELS.
const SEASON_ORDER = Object.keys(SEASON_LABELS);

async function listSeasonsWithEntries() {
  const prisma = getPrismaClient();
  const rows = await prisma.animeSeason.findMany({
    include: { _count: { select: { tierListEntries: true } } },
  });
  return rows
    .map((row) => ({
      id: row.id,
      year: row.year,
      season: row.season,
      status: row.status,
      entriesCount: row._count.tierListEntries,
    }))
    .sort((left, right) => (
      right.year - left.year || SEASON_ORDER.indexOf(right.season) - SEASON_ORDER.indexOf(left.season)
    ));
}

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.anime.tierlist.openings.view");
  if (authorization.response) return authorization.response;

  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get("seasonId");
  const seasons = await listSeasonsWithEntries();
  const themes = seasonId ? await listAnimeTierListThemesForAdmin({ seasonId }) : [];
  return NextResponse.json({ success: true, seasons, themes });
}

export async function POST(request) {
  const payload = await readJsonRequest(request);
  if (!payload?.action) return jsonError("Solicitud inválida.");

  const permission = ["preview-sync", "apply-sync"].includes(payload.action)
    ? "admin.anime.tierlist.openings.sync"
    : payload.action === "create-theme"
      ? "admin.anime.tierlist.openings.create"
      : ["delete-theme", "restore-theme"].includes(payload.action)
        ? "admin.anime.tierlist.openings.delete"
        : "admin.anime.tierlist.openings.update";

  const authorization = await ensurePermissionAuthorized(request, permission);
  if (authorization.response) return authorization.response;

  try {
    if (payload.action === "preview-sync") {
      const preview = await previewAnimeTierListThemeSync(payload);
      return NextResponse.json({
        success: true,
        preview: { seasonId: preview.seasonId, summary: preview.summary, newEntryTitles: preview.newEntryTitles },
      });
    }

    if (payload.action === "apply-sync") {
      const result = await applyAnimeTierListThemeSync(payload);
      await createAuditLog({
        actor: authorization.user,
        action: "import",
        module: "admin.anime.tierlist.openings",
        entityType: "AnimeSeason",
        entityId: String(result.seasonId),
        summary: "Sincronizó Openings/Endings",
        after: result.summary,
        request,
      });
      return NextResponse.json({ success: true, result });
    }

    if (payload.action === "create-theme") {
      const theme = await createAnimeTierListTheme(payload);
      if (!theme.wasAlreadyCreated) await createAuditLog({
        actor: authorization.user,
        action: "create",
        module: "admin.anime.tierlist.openings",
        entityType: "AnimeTierListTheme",
        entityId: String(theme.id),
        entityLabel: `${theme.type}${theme.sequence}`,
        summary: "Agregó un opening/ending manual",
        after: theme,
        request,
      });
      return NextResponse.json({ success: true, theme });
    }

    if (payload.action === "relink-entry") {
      const entry = await relinkAnimeTierListEntry({ id: payload.entryId, aniListId: payload.aniListId });
      await createAuditLog({
        actor: authorization.user,
        action: "update",
        module: "admin.anime.tierlist.openings",
        entityType: "AnimeTierListEntry",
        entityId: String(entry.id),
        entityLabel: entry.title,
        summary: "Cambió la ficha de AniList de un anime",
        after: entry,
        request,
      });
      return NextResponse.json({ success: true, entry });
    }

    if (payload.action === "update-theme") {
      const theme = await updateAnimeTierListTheme(payload);
      await createAuditLog({
        actor: authorization.user,
        action: "update",
        module: "admin.anime.tierlist.openings",
        entityType: "AnimeTierListTheme",
        entityId: String(theme.id),
        entityLabel: `${theme.type}${theme.sequence}`,
        summary: "Editó un opening/ending",
        after: theme,
        request,
      });
      return NextResponse.json({ success: true, theme });
    }

    if (payload.action === "delete-theme") {
      const theme = await deleteAnimeTierListTheme(payload.id);
      await createAuditLog({
        actor: authorization.user,
        action: "delete",
        module: "admin.anime.tierlist.openings",
        entityType: "AnimeTierListTheme",
        entityId: String(theme.id),
        entityLabel: `${theme.type}${theme.sequence}`,
        summary: "Eliminó un opening/ending",
        request,
      });
      return NextResponse.json({ success: true, theme });
    }

    if (payload.action === "restore-theme") {
      const theme = await restoreAnimeTierListTheme(payload.id);
      await createAuditLog({
        actor: authorization.user,
        action: "restore",
        module: "admin.anime.tierlist.openings",
        entityType: "AnimeTierListTheme",
        entityId: String(theme.id),
        entityLabel: `${theme.type}${theme.sequence}`,
        summary: "Restauró un opening/ending",
        request,
      });
      return NextResponse.json({ success: true, theme });
    }

    return jsonUnsupportedAction();
  } catch (error) {
    return jsonError(error.message || "No se pudo actualizar Openings/Endings.");
  }
}
