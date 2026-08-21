import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { jsonError, readJsonRequest } from "@/lib/http";
import { upsertLivePlayback } from "@/lib/repositories/livePlaybackRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

// Espejo de app/api/mobile/v1/lives/[id]/playback/route.js, pero autenticado por cookie de sesión
// (mismo patrón que app/api/live-activity/route.js) en vez de Bearer - reusa upsertLivePlayback tal
// cual, así que un guardado desde la web real y uno desde el WebView del app terminan en la misma
// fila. Invitados no sincronizan progreso (mismo criterio que la ruta mobile).
export async function POST(request, { params }) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const liveId = Number(id);
  if (!Number.isInteger(liveId)) {
    return jsonError("Id inválido.", { status: 400 });
  }

  const payload = await readJsonRequest(request);
  const source = String(payload?.source || "").trim();
  const partIndex = Number(payload?.partIndex);
  const positionSeconds = Math.max(0, Math.floor(Number(payload?.positionSeconds) || 0));
  const durationSeconds = payload?.durationSeconds == null ? null : Math.max(0, Math.floor(Number(payload.durationSeconds)));
  const completed = Boolean(payload?.completed);

  if (!source || !Number.isInteger(partIndex) || partIndex < 0) {
    return jsonError("Faltan datos de reproducción.", { status: 400 });
  }

  const playback = await upsertLivePlayback({ userId: user.id, liveId, source, partIndex, positionSeconds, durationSeconds, completed });

  return NextResponse.json({ success: true, playback });
}
