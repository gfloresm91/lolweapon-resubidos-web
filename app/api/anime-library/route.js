import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { ensureAnyPermissionAuthorized, ensurePermissionAuthorized, validateAnyPermissionSessionToken } from "@/lib/serverAuth";
import {
  getAnimeLibrary,
  hideAnimeMetadata,
  removeAnimeMetadata,
  upsertAnimeMetadata,
} from "@/lib/repositories/animeLibraryRepository";

export const dynamic = "force-dynamic";
const COMPLETED_STATUSES = new Set(["completed", "paused", "pending", "dropped"]);

function getAnimeSection(anime) {
  return COMPLETED_STATUSES.has(anime?.watchStatus) ? "completed" : "tracking";
}

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const canViewAnime = await validateAnyPermissionSessionToken(token, [
    "anime.tracking.view",
    "anime.completed.view",
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
  const animes = await getAnimeLibrary({ includeHidden });
  return NextResponse.json({ animes });
}

export async function POST(request) {
  const payload = await request.json();

  if ((payload?.action === "update" || payload?.action === "upsert") && payload.anime) {
    const section = getAnimeSection(payload.anime);
    const action = payload.key ? "update" : "create";
    const authorization = await ensurePermissionAuthorized(request, `anime.${section}.${action}`);
    if (authorization.response) {
      return authorization.response;
    }

    await upsertAnimeMetadata(payload.key, payload.anime);
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

    await hideAnimeMetadata(payload.key);
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

    await removeAnimeMetadata(payload.key);
    const animes = await getAnimeLibrary({ includeHidden: true });
    return NextResponse.json({ success: true, animes });
  }

  return NextResponse.json(
    { success: false, error: "Acción no soportada" },
    { status: 400 },
  );
}
