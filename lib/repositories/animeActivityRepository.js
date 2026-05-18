import { getPrismaClient } from "@/lib/prisma";

const VALID_LIST_STATUSES = new Set(["want", "watching", "completed"]);

function compactActivity(row) {
  return {
    animeKey: row.anime?.key || "",
    isFavorite: Boolean(row.isFavorite),
    listStatus: row.listStatus || "",
    isHidden: Boolean(row.isHidden),
    favoritedAt: row.favoritedAt?.toISOString() || null,
    statusUpdatedAt: row.statusUpdatedAt?.toISOString() || null,
    hiddenAt: row.hiddenAt?.toISOString() || null,
    updatedAt: row.updatedAt?.toISOString() || null,
  };
}

export async function listAnimeActivityForUser(userId) {
  if (!userId || process.env.DATA_SOURCE !== "postgres") {
    return [];
  }

  const prisma = getPrismaClient();
  const rows = await prisma.platformUserAnime.findMany({
    where: {
      userId: Number(userId),
      OR: [
        { isFavorite: true },
        { listStatus: { not: null } },
        { isHidden: true },
      ],
    },
    include: {
      anime: {
        select: {
          key: true,
        },
      },
    },
    orderBy: [
      { updatedAt: "desc" },
      { id: "desc" },
    ],
  });

  return rows.map(compactActivity).filter((item) => item.animeKey);
}

export async function getAnimeActivityMapForUser(userId) {
  const activity = await listAnimeActivityForUser(userId);
  return Object.fromEntries(activity.map((item) => [item.animeKey, item]));
}

export async function updateAnimeActivityForUser(userId, animeKey, patch = {}) {
  if (!userId) {
    throw new Error("No autorizado.");
  }

  if (process.env.DATA_SOURCE !== "postgres") {
    throw new Error("La actividad personal requiere Postgres.");
  }

  const prisma = getPrismaClient();
  const anime = await prisma.anime.findUnique({
    where: { key: String(animeKey || "") },
    select: { id: true },
  });

  if (!anime) {
    throw new Error("El anime no existe.");
  }

  const now = new Date();
  const data = {};

  if (typeof patch.isFavorite === "boolean") {
    data.isFavorite = patch.isFavorite;
    data.favoritedAt = patch.isFavorite ? now : null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "listStatus")) {
    const nextStatus = String(patch.listStatus || "").trim();
    if (nextStatus && !VALID_LIST_STATUSES.has(nextStatus)) {
      throw new Error("Estado personal inválido.");
    }

    data.listStatus = nextStatus || null;
    data.statusUpdatedAt = nextStatus ? now : null;
  }

  if (typeof patch.isHidden === "boolean") {
    data.isHidden = patch.isHidden;
    data.hiddenAt = patch.isHidden ? now : null;
  }

  if (!Object.keys(data).length) {
    throw new Error("No hay cambios para guardar.");
  }

  const row = await prisma.platformUserAnime.upsert({
    where: {
      userId_animeId: {
        userId: Number(userId),
        animeId: anime.id,
      },
    },
    update: data,
    create: {
      userId: Number(userId),
      animeId: anime.id,
      ...data,
    },
    include: { anime: { select: { key: true } } },
  });

  return compactActivity(row);
}
