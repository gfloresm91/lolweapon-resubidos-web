import { getPrismaClient } from "@/lib/prisma";

/**
 * Upsert de progreso de reproducción (PlatformUserLivePlayback), compartido entre la ruta mobile
 * (Bearer) y la ruta web (cookie de sesión) - la única diferencia entre esos dos llamadores es cómo
 * resuelven userId, la lógica de guardado es idéntica. Extraída de
 * app/api/mobile/v1/lives/[id]/playback/route.js sin cambiar el comportamiento.
 *
 * Cuando `completed` es true, además refleja PlatformUserLive.isWatched - es la fuente de verdad
 * "visto" que ya usa la web, no debe divergir entre plataformas.
 */
export async function upsertLivePlayback({
  userId,
  liveId,
  source,
  partIndex,
  positionSeconds,
  durationSeconds = null,
  completed = false,
  deviceId = null,
}) {
  const prisma = getPrismaClient();

  const playback = await prisma.platformUserLivePlayback.upsert({
    where: { userId_liveId_source_partIndex: { userId, liveId, source, partIndex } },
    create: { userId, liveId, source, partIndex, positionSeconds, durationSeconds, completed, deviceId },
    update: { positionSeconds, durationSeconds, completed, deviceId },
  });

  if (completed) {
    await prisma.platformUserLive.upsert({
      where: { userId_liveId: { userId, liveId } },
      create: { userId, liveId, isWatched: true, watchedAt: new Date() },
      update: { isWatched: true, watchedAt: new Date() },
    });
  }

  return playback;
}
