import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { createPlatformNotification } from "@/lib/repositories/notificationRepository";
import {
  getSeasonalAnimeAdminData,
  setActiveAnimeSeason,
  updateSeasonalAiringOverride,
  updateSeasonalAnimeOverride,
} from "@/lib/repositories/seasonalAnimeCalendarRepository";
import { applySeasonalAnimeSync, previewSeasonalAnimeSync } from "@/lib/seasonalAnimeSync";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "admin.anime.calendar.view");
  if (authorization.response) return authorization.response;
  const { searchParams } = new URL(request.url);
  const result = await getSeasonalAnimeAdminData({ seasonId: searchParams.get("seasonId") });
  return NextResponse.json({ success: true, ...result });
}

export async function POST(request) {
  const payload = await readJsonRequest(request);
  if (!payload?.action) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const permission = ["preview-sync", "apply-sync"].includes(payload.action)
    ? "admin.anime.calendar.sync"
    : "admin.anime.calendar.update";
  const authorization = await ensurePermissionAuthorized(request, permission);
  if (authorization.response) return authorization.response;

  try {
    if (payload.action === "preview-sync") {
      const preview = await previewSeasonalAnimeSync(payload);
      return NextResponse.json({ success: true, preview: { selection: preview.selection, summary: preview.summary } });
    }

    if (payload.action === "apply-sync") {
      const result = await applySeasonalAnimeSync(payload);
      await createAuditLog({
        actor: authorization.user,
        action: "import",
        module: "admin.anime.calendar",
        entityType: "AnimeSeason",
        entityId: String(result.seasonId),
        entityLabel: `${payload.season} ${payload.year}`,
        summary: "Sincronizó el Calendario de temporada",
        after: result.summary,
        request,
      });
      await createPlatformNotification({
        type: "system",
        severity: "success",
        source: "anime-calendar",
        title: "Calendario de temporada sincronizado",
        body: `${payload.season} ${payload.year}: ${result.summary.animes} animes y ${result.summary.airings} emisiones.`,
        href: "/administracion/biblioteca-anime/calendario",
        icon: "CalendarDays",
        audience: "permission:admin.anime.calendar.view",
        actor: authorization.user,
        metadata: result.summary,
      });
      return NextResponse.json({ success: true, result });
    }

    if (payload.action === "activate-season") {
      const season = await setActiveAnimeSeason(payload.id);
      await createAuditLog({
        actor: authorization.user,
        action: "update",
        module: "admin.anime.calendar",
        entityType: "AnimeSeason",
        entityId: String(season.id),
        entityLabel: `${season.season} ${season.year}`,
        summary: "Activó una temporada de anime",
        after: season,
        request,
      });
      return NextResponse.json({ success: true, season });
    }

    if (payload.action === "update-anime") {
      const anime = await updateSeasonalAnimeOverride(payload.anime);
      await createAuditLog({
        actor: authorization.user,
        action: "update",
        module: "admin.anime.calendar",
        entityType: "SeasonalAnime",
        entityId: String(anime.id),
        entityLabel: anime.title,
        summary: "Editó un anime del calendario",
        after: anime,
        request,
      });
      return NextResponse.json({ success: true, anime });
    }

    if (payload.action === "update-airing") {
      const airing = await updateSeasonalAiringOverride(payload.airing);
      await createAuditLog({
        actor: authorization.user,
        action: "update",
        module: "admin.anime.calendar",
        entityType: "SeasonalAnimeAiring",
        entityId: String(airing.id),
        entityLabel: `Episodio ${airing.episode}`,
        summary: "Editó una emisión del calendario",
        after: airing,
        request,
      });
      return NextResponse.json({ success: true, airing });
    }

    return NextResponse.json({ success: false, error: "Acción no soportada." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo actualizar el calendario." }, { status: 400 });
  }
}
