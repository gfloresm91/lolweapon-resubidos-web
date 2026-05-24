import { getPrismaClient } from "@/lib/prisma";

const MIN_SCORE = 1;
const MAX_SCORE = 8;
const SCORE_FACTOR = 10;

function normalizeScore(score) {
  const scoreNum = Number(score);

  if (!Number.isFinite(scoreNum)) {
    throw new Error(`La puntuación debe estar entre ${MIN_SCORE.toFixed(1)} y ${MAX_SCORE.toFixed(1)}.`);
  }

  const scoreTenths = Math.round(scoreNum * SCORE_FACTOR);
  const normalizedScore = scoreTenths / SCORE_FACTOR;

  if (
    scoreTenths < MIN_SCORE * SCORE_FACTOR ||
    scoreTenths > MAX_SCORE * SCORE_FACTOR ||
    Math.abs(normalizedScore - scoreNum) > 0.0001
  ) {
    throw new Error(`La puntuación debe estar entre ${MIN_SCORE.toFixed(1)} y ${MAX_SCORE.toFixed(1)}, usando un decimal.`);
  }

  return scoreTenths;
}

function scoreFromTenths(scoreTenths) {
  return Number(scoreTenths || 0) / SCORE_FACTOR;
}

export async function getStreamerRatingMap() {
  if (process.env.DATA_SOURCE !== "postgres") {
    return {};
  }

  const prisma = getPrismaClient();

  const streamerPermission = await prisma.platformPermission.findUnique({
    where: { code: "anime.rating.streamer" },
    select: { id: true },
  });

  if (!streamerPermission) {
    return {};
  }

  const streamerRoleIds = await prisma.platformRolePermission.findMany({
    where: { permissionId: streamerPermission.id },
    select: { roleId: true },
  });

  if (!streamerRoleIds.length) {
    return {};
  }

  const roleIds = streamerRoleIds.map((r) => r.roleId);

  const ratings = await prisma.animeRating.findMany({
    where: {
      user: {
        roleId: { in: roleIds },
        isActive: true,
        deletedAt: null,
      },
    },
    include: {
      anime: { select: { key: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const map = {};
  for (const rating of ratings) {
    const key = rating.anime?.key;
    if (key && !(key in map)) {
      map[key] = scoreFromTenths(rating.scoreTenths);
    }
  }

  return map;
}

export async function getUserRatingMap(userId) {
  if (!userId || process.env.DATA_SOURCE !== "postgres") {
    return {};
  }

  const prisma = getPrismaClient();
  const ratings = await prisma.animeRating.findMany({
    where: { userId: Number(userId) },
    include: { anime: { select: { key: true } } },
  });

  return Object.fromEntries(
    ratings
      .filter((r) => r.anime?.key)
      .map((r) => [r.anime.key, scoreFromTenths(r.scoreTenths)])
  );
}

export async function upsertAnimeRating(userId, animeKey, score) {
  if (!userId) {
    throw new Error("No autorizado.");
  }

  if (process.env.DATA_SOURCE !== "postgres") {
    throw new Error("Las calificaciones requieren Postgres.");
  }

  const scoreTenths = normalizeScore(score);

  const prisma = getPrismaClient();
  const anime = await prisma.anime.findUnique({
    where: { key: String(animeKey || "") },
    select: { id: true },
  });

  if (!anime) {
    throw new Error("El anime no existe.");
  }

  await prisma.animeRating.upsert({
    where: {
      userId_animeId: {
        userId: Number(userId),
        animeId: anime.id,
      },
    },
    update: { scoreTenths },
    create: {
      userId: Number(userId),
      animeId: anime.id,
      scoreTenths,
    },
  });
}

export async function deleteAnimeRating(userId, animeKey) {
  if (!userId) {
    throw new Error("No autorizado.");
  }

  if (process.env.DATA_SOURCE !== "postgres") {
    throw new Error("Las calificaciones requieren Postgres.");
  }

  const prisma = getPrismaClient();
  const anime = await prisma.anime.findUnique({
    where: { key: String(animeKey || "") },
    select: { id: true },
  });

  if (!anime) {
    return;
  }

  await prisma.animeRating.deleteMany({
    where: {
      userId: Number(userId),
      animeId: anime.id,
    },
  });
}
