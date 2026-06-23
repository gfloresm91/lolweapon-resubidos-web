import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { readJsonRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { createPlatformNotification } from "@/lib/repositories/notificationRepository";
import {
  ensureAnyPermissionAuthorized,
  ensurePermissionAuthorized,
  getCurrentUserFromToken,
  validateAnyPermissionSessionToken,
} from "@/lib/serverAuth";
import {
  getAnimeLibrary,
  getAnimeMetadata,
  hideAnimeMetadata,
  removeAnimeMetadata,
  upsertAnimeMetadata,
} from "@/lib/repositories/animeLibraryRepository";
import { getAnimeActivityMapForUser } from "@/lib/repositories/animeActivityRepository";
import { getStreamerRatingMap, getUserRatingMap } from "@/lib/repositories/animeRatingRepository";

export const dynamic = "force-dynamic";
const COMPLETED_STATUSES = new Set(["completed", "paused", "pending", "dropped"]);

function getAnimeSection(anime) {
  return COMPLETED_STATUSES.has(anime?.watchStatus) ? "completed" : "tracking";
}

export async function GET(request) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const [currentUser, canViewAnime] = await Promise.all([
      getCurrentUserFromToken(token),
      validateAnyPermissionSessionToken(token, [
      "anime.tracking.view",
      "anime.completed.view",
      ]),
    ]);

    if (!canViewAnime) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const includeHidden = await validateAnyPermissionSessionToken(token, [
      "anime.tracking.update",
      "anime.tracking.delete",
      "anime.completed.update",
      "anime.completed.delete",
    ]);
    const [animes, activity, streamerRatings, userRatings] = await Promise.all([
      getAnimeLibrary({ includeHidden }),
      currentUser?.id ? getAnimeActivityMapForUser(currentUser.id) : {},
      getStreamerRatingMap(),
      currentUser?.id ? getUserRatingMap(currentUser.id) : {},
    ]);
    return NextResponse.json({ animes, activity, streamerRatings, userRatings });
  } catch (error) {
    console.error("anime-library:get", error);
    return NextResponse.json(
      { success: false, error: "No se pudo cargar la biblioteca de anime." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  if ((payload?.action === "update" || payload?.action === "upsert") && payload.anime) {
    const section = getAnimeSection(payload.anime);
    const action = payload.key ? "update" : "create";
    const authorization = await ensurePermissionAuthorized(request, `anime.${section}.${action}`);
    if (authorization.response) {
      return authorization.response;
    }

    const before = payload.key ? (await getAnimeMetadata())[payload.key] || null : null;
    const savedAnime = await upsertAnimeMetadata(payload.key, payload.anime);
    await createAuditLog({
      actor: authorization.user,
      action,
      module: section === "completed" ? "admin.anime.completed" : "admin.anime.tracking",
      entityType: "Anime",
      entityId: savedAnime?.id || savedAnime?.key || payload.key || payload.anime?.key,
      entityLabel: savedAnime?.titleEs || savedAnime?.title || payload.anime?.titleEs || payload.anime?.title,
      summary: action === "create" ? "Creó anime" : "Editó anime",
      before,
      after: savedAnime,
      request,
    });
    if (action === "create") {
      const targetPath = section === "completed" ? "/biblioteca-anime/terminados" : "/biblioteca-anime/viendo";
      await createPlatformNotification({
        type: "activity",
        severity: "info",
        title: "Nuevo anime en la biblioteca",
        body: savedAnime?.titleEs || savedAnime?.title || payload.anime?.titleEs || payload.anime?.title,
        href: targetPath,
        icon: "BookOpen",
        audience: "authenticated",
        actor: authorization.user,
        metadata: { animeKey: savedAnime?.key || payload.anime?.key, section },
      });
    }
    const animes = await getAnimeLibrary({ includeHidden: true });
    return NextResponse.json({ success: true, animes });
  }

  if (payload?.action === "delete" && payload.key) {
    const authorization = await ensureAnyPermissionAuthorized(request, [
      "anime.tracking.delete",
      "anime.completed.delete",
    ]);
    if (authorization.response) {
      return authorization.response;
    }

    const before = (await getAnimeMetadata())[payload.key] || null;
    await hideAnimeMetadata(payload.key);
    await createAuditLog({
      actor: authorization.user,
      action: "deactivate",
      module: getAnimeSection(before) === "completed" ? "admin.anime.completed" : "admin.anime.tracking",
      entityType: "Anime",
      entityId: before?.id || payload.key,
      entityLabel: before?.titleEs || before?.title || payload.key,
      summary: "Ocultó anime",
      before,
      after: { ...(before || {}), libraryEnabled: false },
      request,
    });
    const animes = await getAnimeLibrary({ includeHidden: true });
    return NextResponse.json({ success: true, animes });
  }

  if (payload?.action === "remove" && payload.key) {
    const authorization = await ensureAnyPermissionAuthorized(request, [
      "anime.tracking.delete",
      "anime.completed.delete",
    ]);
    if (authorization.response) {
      return authorization.response;
    }

    const before = (await getAnimeMetadata())[payload.key] || null;
    await removeAnimeMetadata(payload.key);
    await createAuditLog({
      actor: authorization.user,
      action: "delete",
      module: getAnimeSection(before) === "completed" ? "admin.anime.completed" : "admin.anime.tracking",
      entityType: "Anime",
      entityId: before?.id || payload.key,
      entityLabel: before?.titleEs || before?.title || payload.key,
      summary: "Eliminó anime",
      before,
      after: null,
      request,
    });
    const animes = await getAnimeLibrary({ includeHidden: true });
    return NextResponse.json({ success: true, animes });
  }

  return NextResponse.json(
    { success: false, error: "Acción no soportada" },
    { status: 400 },
  );
}
