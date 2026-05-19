import { readLives as readJsonLives, writeLives as writeJsonLives } from "@/lib/data";
import { LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";
import { compactLiveRecord, ensureLiveCatalogs, ensureLiveStatus, liveIncludeForData, readLiveStatuses, saveLiveRecord } from "@/lib/liveDbMapping";
import { normalizeLive, normalizeLives, sortLives } from "@/lib/lives";
import { getPrismaClient } from "@/lib/prisma";
import { syncTagSettingsWithLives } from "@/lib/tagSettings";

function parseLiveSortDate(value) {
  const [day = "01", month = "01", year = "1900"] = String(value || "").split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

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

async function updateJsonLiveStatus(id, status) {
  const existingLives = await readJsonLives();
  const nextLives = existingLives.map((live) => (
    live.id === id ? { ...live, status } : live
  ));
  const sortedLives = sortLives(nextLives);
  await writeJsonLives(sortedLives);
  return sortedLives;
}

async function updatePostgresLiveStatus(id, statusValue) {
  const prisma = getPrismaClient();
  await ensureLiveCatalogs(prisma);
  const status = await ensureLiveStatus(prisma, statusValue);

  await prisma.live.updateMany({
    where: { legacyId: id },
    data: { statusId: status.id },
  });

  const lives = await readPostgresLives();
  await syncTagSettingsWithLives(lives);
  return lives;
}

export async function updateLiveStatus(id, status) {
  if (!usePostgres()) {
    return updateJsonLiveStatus(id, status);
  }

  return updatePostgresLiveStatus(id, status);
}

export async function deleteLive(id) {
  if (!usePostgres()) {
    const nextLives = (await readJsonLives()).filter((live) => live.id !== id);
    await writeJsonLives(nextLives);
    return nextLives;
  }

  return deletePostgresLive(id);
}

async function getLiveWithNeighborsFromJson(legacyId) {
  const lives = await readJsonLives();
  const sorted = [...lives].sort((a, b) => {
    const dateCompare = parseLiveSortDate(a.date).localeCompare(parseLiveSortDate(b.date));
    return dateCompare !== 0 ? dateCompare : String(a.id || "").localeCompare(String(b.id || ""));
  });
  const index = sorted.findIndex((item) => item.id === legacyId);

  if (index === -1) {
    return { live: null, previousLive: null, nextLive: null };
  }

  return {
    live: sorted[index],
    previousLive: index > 0 ? sorted[index - 1] : null,
    nextLive: index < sorted.length - 1 ? sorted[index + 1] : null,
  };
}

async function getLiveWithNeighborsFromPostgres(legacyId) {
  const prisma = getPrismaClient();
  const row = await prisma.live.findFirst({
    where: { legacyId },
    include: liveIncludeForData,
  });

  if (!row) {
    return { live: null, previousLive: null, nextLive: null };
  }

  const live = compactLiveRecord(row);
  const liveDate = row.date;
  const liveId = row.id;

  const dateFilter = liveDate
    ? { OR: [{ date: { lt: liveDate } }, { date: liveDate, id: { lt: liveId } }] }
    : { id: { lt: liveId } };
  const nextDateFilter = liveDate
    ? { OR: [{ date: { gt: liveDate } }, { date: liveDate, id: { gt: liveId } }] }
    : { id: { gt: liveId } };

  const [prevRow, nextRow] = await Promise.all([
    prisma.live.findFirst({
      where: dateFilter,
      orderBy: liveDate ? [{ date: "desc" }, { id: "desc" }] : [{ id: "desc" }],
      include: liveIncludeForData,
    }),
    prisma.live.findFirst({
      where: nextDateFilter,
      orderBy: liveDate ? [{ date: "asc" }, { id: "asc" }] : [{ id: "asc" }],
      include: liveIncludeForData,
    }),
  ]);

  return {
    live,
    previousLive: prevRow ? compactLiveRecord(prevRow) : null,
    nextLive: nextRow ? compactLiveRecord(nextRow) : null,
  };
}

export async function getLiveWithNeighbors(legacyId) {
  if (!usePostgres()) {
    return getLiveWithNeighborsFromJson(legacyId);
  }

  return getLiveWithNeighborsFromPostgres(legacyId);
}

export async function getLiveStatuses() {
  if (!usePostgres()) {
    return LIVE_STATUS_OPTIONS;
  }

  return readLiveStatuses(getPrismaClient());
}
