import { readLives as readJsonLives, writeLives as writeJsonLives } from "@/lib/data";
import { LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";
import { compactLiveRecord, ensureLiveCatalogs, ensureLiveStatus, liveIncludeForData, readLiveStatuses, saveLiveRecord } from "@/lib/liveDbMapping";
import { normalizeLive, normalizeLives, sortLives } from "@/lib/lives";
import { getPrismaClient } from "@/lib/prisma";
import { syncTagSettingsWithLives } from "@/lib/tagSettings";
import { cacheLiveCatalog, liveCatalogCache } from "../liveCatalogState.js";

const LIVE_CATALOG_CACHE_TTL_MS = 10 * 1000;

async function loadLiveCatalog() {
  if (!usePostgres()) {
    return readJsonLives();
  }

  return readPostgresLives();
}

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

async function readRecentPostgresLives(limit) {
  const prisma = getPrismaClient();
  const rows = await prisma.live.findMany({
    orderBy: [
      { date: "desc" },
      { id: "desc" },
    ],
    take: limit,
    include: liveIncludeForData,
  });

  return sortLives(rows.map(compactLiveRecord)).slice(0, limit);
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
  if (liveCatalogCache.value && Date.now() - liveCatalogCache.loadedAt <= LIVE_CATALOG_CACHE_TTL_MS) {
    return liveCatalogCache.value;
  }

  if (!liveCatalogCache.promise) {
    const revisionAtStart = liveCatalogCache.revision;
    const request = loadLiveCatalog()
      .then((lives) => {
        if (liveCatalogCache.revision === revisionAtStart) {
          liveCatalogCache.value = lives;
          liveCatalogCache.loadedAt = Date.now();
          return lives;
        }
        return liveCatalogCache.value || lives;
      })
      .finally(() => {
        if (liveCatalogCache.promise === request) {
          liveCatalogCache.promise = null;
        }
      });
    liveCatalogCache.promise = request;
  }

  return liveCatalogCache.promise;
}

export async function readRecentLives({ limit = 10 } = {}) {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  if (!usePostgres()) {
    return sortLives(normalizeLives(await readJsonLives())).slice(0, normalizedLimit);
  }

  return readRecentPostgresLives(normalizedLimit);
}

export async function writeLives(lives) {
  if (!usePostgres()) {
    await writeJsonLives(lives);
    return cacheLiveCatalog(sortLives(normalizeLives(lives)), { action: "replaced", broadcast: true });
  }

  return cacheLiveCatalog(await replacePostgresLives(lives), { action: "replaced", broadcast: true });
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
    return cacheLiveCatalog(sortedLives, { action: index >= 0 ? "updated" : "created", liveId: normalizedLive.id, broadcast: true });
  }

  return cacheLiveCatalog(await upsertPostgresLive(live), { action: "upserted", liveId: live?.id || null, broadcast: true });
}

export async function bulkUpdateLives(lives) {
  const normalizedUpdates = normalizeLives(lives);

  if (!usePostgres()) {
    const existingLives = await readJsonLives();
    const updatesById = new Map(normalizedUpdates.map((live) => [live.id, live]));
    const nextLives = sortLives(existingLives.map((live) => updatesById.get(live.id) || live));
    await writeJsonLives(nextLives);
    return cacheLiveCatalog(nextLives, { action: "bulk-updated", broadcast: true });
  }

  const prisma = getPrismaClient();
  await ensureLiveCatalogs(prisma);
  const cache = {
    statuses: new Map(),
    platforms: new Map(),
    tags: new Map(),
  };
  const transactionTimeout = Math.min(120000, Math.max(30000, normalizedUpdates.length * 750));
  await prisma.$transaction(async (transaction) => {
    for (const live of normalizedUpdates) {
      const existing = await transaction.live.findUnique({ where: { id: Number(live.dbId) } });
      if (!existing || existing.legacyId !== live.id) {
        throw new Error(`El registro ${live.id} cambió antes de aplicar la importación.`);
      }
      await saveLiveRecord(transaction, live, cache);
    }
  }, {
    maxWait: 10000,
    timeout: transactionTimeout,
  });

  const nextLives = await readPostgresLives();
  await syncTagSettingsWithLives(nextLives);
  return cacheLiveCatalog(nextLives, { action: "bulk-updated", broadcast: true });
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
    return cacheLiveCatalog(await updateJsonLiveStatus(id, status), { action: "status-updated", liveId: id, broadcast: true });
  }

  return cacheLiveCatalog(await updatePostgresLiveStatus(id, status), { action: "status-updated", liveId: id, broadcast: true });
}

export async function deleteLive(id) {
  if (!usePostgres()) {
    const nextLives = (await readJsonLives()).filter((live) => live.id !== id);
    await writeJsonLives(nextLives);
    return cacheLiveCatalog(nextLives, { action: "deleted", liveId: id, broadcast: true });
  }

  return cacheLiveCatalog(await deletePostgresLive(id), { action: "deleted", liveId: id, broadcast: true });
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

export async function getLiveById(id) {
  if (!usePostgres()) {
    return null;
  }

  const prisma = getPrismaClient();
  const row = await prisma.live.findUnique({
    where: { id: Number(id) },
    include: liveIncludeForData,
  });

  return row ? compactLiveRecord(row) : null;
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
