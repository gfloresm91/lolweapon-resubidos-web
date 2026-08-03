import { NextResponse } from "next/server";

import { jsonError, jsonUnsupportedAction, readJsonRequest } from "@/lib/http";
import {
  getAnimeTierListBoard,
  getEntriesWithoutThemeForSeason,
  resetAnimeTierListBoard,
  saveAnimeTierListBoard,
  setAnimeTierListVisibility,
} from "@/lib/repositories/animeTierListRepository";
import {
  createAnimeTierListTheme,
  deleteAnimeTierListTheme,
  removeAnimeTierListTheme,
  restoreAnimeTierListTheme,
  updateAnimeTierListTheme,
  updateAnimeTierListThemeVisibility,
} from "@/lib/repositories/animeTierListThemeRepository";
import {
  deleteAnimeTierListEntry,
  duplicateAnimeTierListEntryAsManual,
  relinkAnimeTierListEntry,
  updateAnimeTierListEntry,
} from "@/lib/repositories/animeTierListEntryRepository";
import { can } from "@/lib/repositories/platformUserRepository";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const VALID_KINDS = new Set(["animes", "op", "ed"]);
const MANAGE_THEMES_PERMISSION = "anime.tierlist.openings.manage";

function permissionForKind(kind) {
  return kind === "animes" ? "anime.tierlist.animes.view" : "anime.tierlist.openings.view";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  if (!VALID_KINDS.has(kind)) return jsonError("Tablero inválido.");

  const authorization = await ensurePermissionAuthorized(request, permissionForKind(kind));
  if (authorization.response) return authorization.response;

  const board = await getAnimeTierListBoard({
    kind,
    seasonId: searchParams.get("seasonId"),
    userId: authorization.user?.id || null,
  });

  const canManageThemes = kind !== "animes" && can(authorization.user, MANAGE_THEMES_PERMISSION);
  const entriesWithoutTheme = canManageThemes && board.season
    ? await getEntriesWithoutThemeForSeason(board.season.id, kind)
    : [];

  return NextResponse.json({ success: true, ...board, canManageThemes, entriesWithoutTheme });
}

export async function POST(request) {
  const payload = await readJsonRequest(request);
  if (!VALID_KINDS.has(payload?.kind)) return jsonError("Tablero inválido.");

  const authorization = await ensurePermissionAuthorized(request, permissionForKind(payload.kind));
  if (authorization.response) return authorization.response;

  if (["create-theme", "update-theme", "update-theme-visibility", "delete-theme", "restore-theme", "remove-theme", "relink-entry", "duplicate-entry", "update-entry", "delete-entry"].includes(payload.action)) {
    if (payload.kind === "animes" || !can(authorization.user, MANAGE_THEMES_PERMISSION)) {
      return jsonError("Permiso insuficiente", { status: 403 });
    }

    try {
      if (payload.action === "relink-entry") {
        const entry = await relinkAnimeTierListEntry({ id: payload.entryId, aniListId: payload.aniListId });
        await createAuditLog({
          actor: authorization.user,
          action: "update",
          module: "admin.anime.tierlist.openings",
          entityType: "AnimeTierListEntry",
          entityId: String(entry.id),
          entityLabel: entry.title,
          summary: "Cambió la ficha de AniList de un anime desde el tablero",
          after: entry,
          request,
        });
        return NextResponse.json({ success: true, entry });
      }

      if (payload.action === "create-theme") {
        const theme = await createAnimeTierListTheme(payload);
        await createAuditLog({
          actor: authorization.user,
          action: "create",
          module: "admin.anime.tierlist.openings",
          entityType: "AnimeTierListTheme",
          entityId: String(theme.id),
          entityLabel: `${theme.type}${theme.sequence}`,
          summary: "Agregó un opening/ending manual desde el tablero",
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
          summary: "Ocultó un opening/ending desde el tablero",
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
          summary: "Volvió a mostrar un opening/ending desde el tablero",
          request,
        });
        return NextResponse.json({ success: true, theme });
      }

      if (payload.action === "update-theme-visibility") {
        const theme = await updateAnimeTierListThemeVisibility({ id: payload.id, manualVisible: payload.manualVisible });
        await createAuditLog({
          actor: authorization.user,
          action: "update",
          module: "admin.anime.tierlist.openings",
          entityType: "AnimeTierListTheme",
          entityId: String(theme.id),
          entityLabel: `${theme.type}${theme.sequence}`,
          summary: payload.manualVisible === false ? "Pasó un opening/ending a borrador desde el tablero" : "Publicó un opening/ending desde el tablero",
          after: theme,
          request,
        });
        return NextResponse.json({ success: true, theme });
      }

      if (payload.action === "remove-theme") {
        const theme = await removeAnimeTierListTheme(payload.id);
        await createAuditLog({
          actor: authorization.user,
          action: "delete",
          module: "admin.anime.tierlist.openings",
          entityType: "AnimeTierListTheme",
          entityId: String(theme.id),
          entityLabel: `${theme.type}${theme.sequence}`,
          summary: "Eliminó un opening/ending desde el tablero",
          request,
        });
        return NextResponse.json({ success: true, theme });
      }

      if (payload.action === "duplicate-entry") {
        const entry = await duplicateAnimeTierListEntryAsManual({
          sourceEntryId: payload.entryId,
          seasonId: payload.seasonId,
          title: payload.title,
          imageUrl: payload.imageUrl,
          isAdult: payload.isAdult,
          isDonghua: payload.isDonghua,
        });
        await createAuditLog({
          actor: authorization.user,
          action: "create",
          module: "admin.anime.tierlist.openings",
          entityType: "AnimeTierListEntry",
          entityId: String(entry.id),
          entityLabel: entry.title,
          summary: "Duplicó un anime sin tema como entrada manual desde el tablero",
          after: entry,
          request,
        });
        return NextResponse.json({ success: true, entry });
      }

      if (payload.action === "update-entry") {
        const entry = await updateAnimeTierListEntry({ id: payload.id, manualVisible: payload.manualVisible });
        await createAuditLog({
          actor: authorization.user,
          action: "update",
          module: "admin.anime.tierlist.openings",
          entityType: "AnimeTierListEntry",
          entityId: String(entry.id),
          entityLabel: entry.title,
          summary: payload.manualVisible === false ? "Ocultó un anime sin tema desde el tablero" : "Mostró un anime sin tema desde el tablero",
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
          module: "admin.anime.tierlist.openings",
          entityType: "AnimeTierListEntry",
          entityId: String(entry.id),
          entityLabel: entry.title,
          summary: "Eliminó un anime sin tema desde el tablero",
          request,
        });
        return NextResponse.json({ success: true, entry });
      }

      const theme = await updateAnimeTierListTheme(payload);
      await createAuditLog({
        actor: authorization.user,
        action: "update",
        module: "admin.anime.tierlist.openings",
        entityType: "AnimeTierListTheme",
        entityId: String(theme.id),
        entityLabel: `${theme.type}${theme.sequence}`,
        summary: "Editó un opening/ending desde el tablero",
        after: theme,
        request,
      });
      return NextResponse.json({ success: true, theme });
    } catch (error) {
      return jsonError(error.message || "No se pudo guardar el tema.");
    }
  }

  if (!authorization.user?.id) {
    return jsonError("Inicia sesión para guardar tu tier list.", { status: 401 });
  }

  try {
    if (payload.action === "save") {
      const result = await saveAnimeTierListBoard({
        userId: authorization.user.id,
        seasonId: payload.seasonId,
        kind: payload.kind,
        tiers: payload.tiers,
        placements: payload.placements,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (payload.action === "reset") {
      const result = await resetAnimeTierListBoard({
        userId: authorization.user.id,
        seasonId: payload.seasonId,
        kind: payload.kind,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (payload.action === "set-public") {
      const result = await setAnimeTierListVisibility({
        userId: authorization.user.id,
        seasonId: payload.seasonId,
        kind: payload.kind,
        isPublic: payload.isPublic,
      });
      return NextResponse.json({ success: true, ...result });
    }

    return jsonUnsupportedAction();
  } catch (error) {
    return jsonError(error.message || "No se pudo guardar tu tier list.");
  }
}
