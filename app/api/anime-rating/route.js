import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { readJsonRequest } from "@/lib/http";
import { can } from "@/lib/repositories/platformUserRepository";
import {
  deleteAnimeRating,
  upsertAnimeRating,
} from "@/lib/repositories/animeRatingRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return getCurrentUserFromToken(token);
}

export async function POST(request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
  }

  if (!can(user, "anime.rating.write")) {
    return NextResponse.json({ success: false, error: "Sin permiso para calificar." }, { status: 403 });
  }

  const payload = await readJsonRequest(request);

  if (!payload || !payload.animeKey || !payload.action) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    if (payload.action === "upsert") {
      await upsertAnimeRating(user.id, payload.animeKey, payload.score);
      return NextResponse.json({ success: true });
    }

    if (payload.action === "delete") {
      await deleteAnimeRating(user.id, payload.animeKey);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo guardar la calificación." },
      { status: 400 },
    );
  }
}
