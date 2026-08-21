import { jsonError, readJsonRequest } from "@/lib/http";
import { getMobileUserIdFromRequest } from "@/lib/mobileAuth";
import { upsertLivePlayback } from "@/lib/repositories/livePlaybackRepository";

export const dynamic = "force-dynamic";

// Requiere auth mobile - invitados no sincronizan progreso, mismo criterio que el resto de la app
// (progreso es solo estado de UI hasta que hay cuenta real).
export async function POST(request, { params }) {
  const { id } = await params;
  const liveId = Number(id);
  if (!Number.isInteger(liveId)) {
    return jsonError("Id inválido.", { status: 400 });
  }

  const userId = await getMobileUserIdFromRequest(request);
  if (!userId) {
    return jsonError("No autenticado.", { status: 401 });
  }

  const payload = await readJsonRequest(request);
  const source = String(payload?.source || "").trim();
  const partIndex = Number(payload?.partIndex);
  const positionSeconds = Math.max(0, Math.floor(Number(payload?.positionSeconds) || 0));
  const durationSeconds = payload?.durationSeconds == null ? null : Math.max(0, Math.floor(Number(payload.durationSeconds)));
  const completed = Boolean(payload?.completed);
  const deviceId = payload?.deviceId ? String(payload.deviceId).trim() : null;

  if (!source || !Number.isInteger(partIndex) || partIndex < 0) {
    return jsonError("Faltan datos de reproducción.", { status: 400 });
  }

  const playback = await upsertLivePlayback({ userId, liveId, source, partIndex, positionSeconds, durationSeconds, completed, deviceId });

  return Response.json({ success: true, playback });
}
