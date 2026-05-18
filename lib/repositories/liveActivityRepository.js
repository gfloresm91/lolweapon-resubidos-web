import { getPrismaClient } from "@/lib/prisma";

function compactActivity(row) {
  return {
    liveId: row.live?.legacyId || "",
    isSaved: Boolean(row.isSaved),
    isWatched: Boolean(row.isWatched),
    savedAt: row.savedAt?.toISOString() || null,
    watchedAt: row.watchedAt?.toISOString() || null,
    updatedAt: row.updatedAt?.toISOString() || null,
  };
}

export async function listLiveActivityForUser(userId) {
  if (!userId || process.env.DATA_SOURCE !== "postgres") {
    return [];
  }

  const prisma = getPrismaClient();
  const rows = await prisma.platformUserLive.findMany({
    where: {
      userId: Number(userId),
      OR: [
        { isSaved: true },
        { isWatched: true },
      ],
    },
    include: {
      live: {
        select: {
          legacyId: true,
        },
      },
    },
    orderBy: [
      { updatedAt: "desc" },
      { id: "desc" },
    ],
  });

  return rows.map(compactActivity).filter((item) => item.liveId);
}

export async function getLiveActivityMapForUser(userId) {
  const activity = await listLiveActivityForUser(userId);
  return Object.fromEntries(activity.map((item) => [item.liveId, item]));
}

export async function getLiveActivityForLive(userId, legacyLiveId) {
  if (!userId || process.env.DATA_SOURCE !== "postgres") {
    return null;
  }

  const prisma = getPrismaClient();
  const row = await prisma.platformUserLive.findFirst({
    where: {
      userId: Number(userId),
      live: { legacyId: String(legacyLiveId || "") },
    },
    include: {
      live: { select: { legacyId: true } },
    },
  });

  return row ? compactActivity(row) : null;
}

export async function updateLiveActivityForUser(userId, legacyLiveId, patch = {}) {
  if (!userId) {
    throw new Error("No autorizado.");
  }

  if (process.env.DATA_SOURCE !== "postgres") {
    throw new Error("La actividad personal requiere Postgres.");
  }

  const prisma = getPrismaClient();
  const live = await prisma.live.findUnique({
    where: { legacyId: String(legacyLiveId || "") },
    select: { id: true },
  });

  if (!live) {
    throw new Error("El directo no existe.");
  }

  const now = new Date();
  const data = {};

  if (typeof patch.isSaved === "boolean") {
    data.isSaved = patch.isSaved;
    data.savedAt = patch.isSaved ? now : null;
  }

  if (typeof patch.isWatched === "boolean") {
    data.isWatched = patch.isWatched;
    data.watchedAt = patch.isWatched ? now : null;
  }

  if (!Object.keys(data).length) {
    throw new Error("No hay cambios para guardar.");
  }

  const row = await prisma.platformUserLive.upsert({
    where: {
      userId_liveId: {
        userId: Number(userId),
        liveId: live.id,
      },
    },
    update: data,
    create: {
      userId: Number(userId),
      liveId: live.id,
      ...data,
    },
    include: { live: { select: { legacyId: true } } },
  });

  return compactActivity(row);
}
