import { jsonError, readJsonRequest } from "@/lib/http";
import { getMobileUserIdFromRequest } from "@/lib/mobileAuth";
import { getPrismaClient } from "@/lib/prisma";

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

  const prisma = getPrismaClient();

  const playback = await prisma.platformUserLivePlayback.upsert({
    where: { userId_liveId_source_partIndex: { userId, liveId, source, partIndex } },
    create: { userId, liveId, source, partIndex, positionSeconds, durationSeconds, completed, deviceId },
    update: { positionSeconds, durationSeconds, completed, deviceId },
  });

  // PlatformUserLive.isWatched es la fuente de verdad "visto" que ya usa la web (PlatformUserLive
  // existente) - si no se refleja acá, web y mobile divergen en ese estado.
  if (completed) {
    await prisma.platformUserLive.upsert({
      where: { userId_liveId: { userId, liveId } },
      create: { userId, liveId, isWatched: true, watchedAt: new Date() },
      update: { isWatched: true, watchedAt: new Date() },
    });
  }

  return Response.json({ success: true, playback });
}
