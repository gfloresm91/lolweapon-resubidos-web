import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { getMobileUserIdFromRequest } from "@/lib/mobileAuth";
import {
  getLiveActivityMapForUser,
  updateLiveActivityForUser,
} from "@/lib/repositories/liveActivityRepository";

// Espejo de app/api/live-activity/route.js (auth por cookie de sesión) pero resolviendo el usuario
// por Bearer - reusa las mismas funciones de repo, así que "Guardar"/"Visto" significan exactamente
// lo mismo que en la web (misma tabla PlatformUserLive, misma clave legacyId).
export const dynamic = "force-dynamic";

export async function GET(request) {
  const userId = await getMobileUserIdFromRequest(request);

  if (!userId) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const activity = await getLiveActivityMapForUser(userId);
  return NextResponse.json({ success: true, activity });
}

export async function POST(request) {
  const userId = await getMobileUserIdFromRequest(request);

  if (!userId) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    const activity = await updateLiveActivityForUser(userId, payload.liveId, {
      isSaved: typeof payload.isSaved === "boolean" ? payload.isSaved : undefined,
      isWatched: typeof payload.isWatched === "boolean" ? payload.isWatched : undefined,
    });

    return NextResponse.json({ success: true, activity });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo guardar la actividad." },
      { status: 400 },
    );
  }
}
