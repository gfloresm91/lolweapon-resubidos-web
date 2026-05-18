import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { readJsonRequest } from "@/lib/http";
import {
  listAnimeActivityForUser,
  updateAnimeActivityForUser,
} from "@/lib/repositories/animeActivityRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return getCurrentUserFromToken(token);
}

export async function GET(request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const activity = await listAnimeActivityForUser(user.id);
  return NextResponse.json({ success: true, activity });
}

export async function POST(request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    const activity = await updateAnimeActivityForUser(user.id, payload.animeKey, {
      isFavorite: typeof payload.isFavorite === "boolean" ? payload.isFavorite : undefined,
      listStatus: Object.prototype.hasOwnProperty.call(payload, "listStatus") ? payload.listStatus : undefined,
      isHidden: typeof payload.isHidden === "boolean" ? payload.isHidden : undefined,
    });

    return NextResponse.json({ success: true, activity });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo guardar la actividad." },
      { status: 400 },
    );
  }
}
