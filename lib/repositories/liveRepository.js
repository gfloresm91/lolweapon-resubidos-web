import { readLives as readJsonLives, writeLives as writeJsonLives } from "@/lib/data";
import { LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";
import { compactLiveRecord, ensureLiveCatalogs, liveIncludeForData, readLiveStatuses, saveLiveRecord } from "@/lib/liveDbMapping";
import { normalizeLive, normalizeLives, sortLives } from "@/lib/lives";
import { getPrismaClient } from "@/lib/prisma";
import { syncTagSettingsWithLives } from "@/lib/tagSettings";

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

async function readPostgresLives() {
  const prisma = getPrismaClient();
  const rows = await prisma.live.findMany({
    orderBy: [
      { date: "desc" },
      { id: "desc" },
    ],
    include: liveIncludeForData,
  });

  return sortLives(rows.map(compactLiveRecord));
}

async function replacePostgresLives(lives) {
  const prisma = getPrismaClient();
  const normalizedLives = sortLives(normalizeLives(lives));

  await ensureLiveCatalogs(prisma);
  await prisma.live.deleteMany();

  for (const live of normalizedLives) {
    await saveLiveRecord(prisma, live);
  }

  await syncTagSettingsWithLives(normalizedLives);
  return normalizedLives;
}

async function upsertPostgresLive(live) {
  const prisma = getPrismaClient();
  const normalizedLive = normalizeLive(live);

  await ensureLiveCatalogs(prisma);
  await saveLiveRecord(prisma, normalizedLive);

  const lives = await readPostgresLives();
  await syncTagSettingsWithLives(lives);
  return lives;
}

async function deletePostgresLive(id) {
  const prisma = getPrismaClient();

  await prisma.live.deleteMany({
    where: { legacyId: id },
  });

  const lives = await readPostgresLives();
  await syncTagSettingsWithLives(lives);
  return lives;
}

export async function readLives() {
  if (!usePostgres()) {
    return readJsonLives();
  }

  return readPostgresLives();
}

export async function writeLives(lives) {
  if (!usePostgres()) {
    await writeJsonLives(lives);
    return sortLives(normalizeLives(lives));
  }

  return replacePostgresLives(lives);
}

export async function upsertLive(live) {
  if (!usePostgres()) {
    const existingLives = await readJsonLives();
    const normalizedLive = normalizeLive(live);
    const index = existingLives.findIndex((existingLive) => existingLive.id === normalizedLive.id);
    const nextLives = [...existingLives];

    if (index >= 0) {
      nextLives[index] = normalizedLive;
    } else {
      nextLives.unshift(normalizedLive);
    }

    const sortedLives = sortLives(nextLives);
    await writeJsonLives(sortedLives);
    return sortedLives;
  }

  return upsertPostgresLive(live);
}

export async function deleteLive(id) {
  if (!usePostgres()) {
    const nextLives = (await readJsonLives()).filter((live) => live.id !== id);
    await writeJsonLives(nextLives);
    return nextLives;
  }

  return deletePostgresLive(id);
}

export async function getLiveStatuses() {
  if (!usePostgres()) {
    return LIVE_STATUS_OPTIONS;
  }

  return readLiveStatuses(getPrismaClient());
}
