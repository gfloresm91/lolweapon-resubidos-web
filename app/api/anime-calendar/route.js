import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { getSeasonalAnimeCalendar, toggleSeasonalAnimeFavorite } from "@/lib/repositories/seasonalAnimeCalendarRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await ensurePermissionAuthorized(request, "anime.calendar.view");
  if (authorization.response) return authorization.response;
  const { searchParams } = new URL(request.url);
  const result = await getSeasonalAnimeCalendar({
    seasonId: searchParams.get("seasonId"),
    userId: authorization.user?.id || null,
  });
  return NextResponse.json({ success: true, ...result });
}

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "anime.calendar.view");
  if (authorization.response) return authorization.response;
  if (!authorization.user?.id) {
    return NextResponse.json({ success: false, error: "Inicia sesión para guardar favoritos." }, { status: 401 });
  }

  const payload = await readJsonRequest(request);
  if (payload?.action !== "toggle-favorite") {
    return NextResponse.json({ success: false, error: "Acción no soportada." }, { status: 400 });
  }

  try {
    const result = await toggleSeasonalAnimeFavorite(authorization.user.id, payload.aniListId, payload.isFavorite);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo guardar el favorito." }, { status: 400 });
  }
}
