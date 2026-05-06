import {
  buildAnimeLibrary,
  deleteAnimeMetadataEntry,
  hideAnimeMetadataEntry,
  normalizeComparable,
  normalizeEditableAnimeMetadataItem,
  readAnimeMetadata,
  titleFromTag,
  updateAnimeMetadataEntry,
} from "@/lib/animeLibrary";
import {
  animeIncludeForMetadata,
  compactAnimeRecord,
  ensureAnimeCatalogs,
  ensureAnimeFormat,
  ensureAnimeReleaseStatus,
  ensureAnimeTag,
  ensureExternalProvider,
  getIsFullSeason,
  getPurchasedEpisodes,
  toNullableInt,
  toNullableString,
  toTrimmedString,
} from "@/lib/animeDbMapping";
import { getPrismaClient } from "@/lib/prisma";
import { normalizeTag } from "@/lib/tags";

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function getAnimeTitle(key, item) {
  return String(item.title || item.titleEs || titleFromTag(item.tag || key)).trim();
}

async function readPostgresAnimeMetadata() {
  const prisma = getPrismaClient();
  const rows = await prisma.anime.findMany({
    orderBy: { key: "asc" },
    include: animeIncludeForMetadata,
  });

  return Object.fromEntries(rows.map((row) => [row.key, compactAnimeRecord(row)]));
}

async function findExistingAnimeKey(prisma, normalizedKey, nextItem) {
  const byKey = await prisma.anime.findUnique({
    where: { key: normalizedKey },
    select: { key: true },
  });

  if (byKey) {
    return normalizedKey;
  }

  const incomingAliases = [
    nextItem?.tag,
    nextItem?.title,
    nextItem?.titleEs,
  ].map(normalizeComparable).filter(Boolean);

  if (!incomingAliases.length) {
    return null;
  }

  const rows = await prisma.anime.findMany({
    select: {
      key: true,
      title: true,
      titleEs: true,
      libraryEntry: {
        select: {
          trackerTag: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return rows.find((row) => (
    [row.libraryEntry?.trackerTag?.name, row.title, row.titleEs]
      .map(normalizeComparable)
      .some((alias) => alias && incomingAliases.includes(alias))
  ))?.key || null;
}

async function savePostgresAnimeMetadataEntry(prisma, key, item) {
  await ensureAnimeCatalogs(prisma);

  const format = await ensureAnimeFormat(prisma, item.format);
  const releaseStatus = await ensureAnimeReleaseStatus(prisma, item.status);
  const trackerTag = await ensureAnimeTag(prisma, item.tag);
  const isFullSeason = getIsFullSeason(item);
  const watchStatusCode = isFullSeason ? "purchased" : toTrimmedString(item.watchStatus) || "pending";
  const watchStatus = await prisma.animeWatchStatus.upsert({
    where: { code: watchStatusCode },
    update: {
      label: watchStatusCode,
      isActive: true,
    },
    create: {
      code: watchStatusCode,
      label: watchStatusCode,
    },
  });
  const anime = await prisma.anime.upsert({
    where: { key },
    update: {
      title: getAnimeTitle(key, item),
      titleEs: toNullableString(item.titleEs),
      image: toNullableString(item.image),
      description: toNullableString(item.description),
      descriptionEs: toNullableString(item.descriptionEs),
      year: toNullableInt(item.year),
      episodes: toNullableInt(item.episodes),
      formatId: format?.id ?? null,
      releaseStatusId: releaseStatus?.id ?? null,
    },
    create: {
      key,
      title: getAnimeTitle(key, item),
      titleEs: toNullableString(item.titleEs),
      image: toNullableString(item.image),
      description: toNullableString(item.description),
      descriptionEs: toNullableString(item.descriptionEs),
      year: toNullableInt(item.year),
      episodes: toNullableInt(item.episodes),
      formatId: format?.id ?? null,
      releaseStatusId: releaseStatus?.id ?? null,
    },
  });

  await prisma.animeLibraryEntry.upsert({
    where: { animeId: anime.id },
    update: {
      watchStatusId: watchStatus.id,
      trackerTagId: trackerTag?.id ?? null,
      currentEpisode: toNullableInt(item.currentEpisode),
      purchasedEpisodes: getPurchasedEpisodes(item.purchased),
      isFullSeason,
      libraryEnabled: item.libraryEnabled === false ? false : true,
      trackerUrl: toNullableString(item.trackerUrl),
      deletedAt: null,
    },
    create: {
      animeId: anime.id,
      watchStatusId: watchStatus.id,
      trackerTagId: trackerTag?.id ?? null,
      currentEpisode: toNullableInt(item.currentEpisode),
      purchasedEpisodes: getPurchasedEpisodes(item.purchased),
      isFullSeason,
      libraryEnabled: item.libraryEnabled === false ? false : true,
      trackerUrl: toNullableString(item.trackerUrl),
      deletedAt: null,
    },
  });

  const provider = await ensureExternalProvider(prisma, item.provider);

  if (provider) {
    await prisma.animeExternalReference.upsert({
      where: {
        animeId_providerId: {
          animeId: anime.id,
          providerId: provider.id,
        },
      },
      update: {
        providerMediaId: toNullableInt(item.providerId),
        url: toNullableString(item.providerUrl),
      },
      create: {
        animeId: anime.id,
        providerId: provider.id,
        providerMediaId: toNullableInt(item.providerId),
        url: toNullableString(item.providerUrl),
      },
    });
  } else {
    await prisma.animeExternalReference.deleteMany({
      where: { animeId: anime.id },
    });
  }

  return prisma.anime.findUnique({
    where: { key },
    include: animeIncludeForMetadata,
  });
}

async function updatePostgresAnimeMetadataEntry(key, nextItem) {
  const normalizedKey = normalizeTag(key || nextItem?.tag || nextItem?.title || nextItem?.titleEs);

  if (!normalizedKey) {
    throw new Error("Tag invalido");
  }

  const prisma = getPrismaClient();
  const existingKey = await findExistingAnimeKey(prisma, normalizedKey, nextItem);
  const targetKey = existingKey || normalizedKey;
  const currentRow = existingKey
    ? await prisma.anime.findUnique({ where: { key: existingKey }, include: animeIncludeForMetadata })
    : null;
  const currentItem = currentRow ? compactAnimeRecord(currentRow) : {};
  const normalizedItem = normalizeEditableAnimeMetadataItem({
    ...currentItem,
    ...nextItem,
    tag: nextItem?.tag || currentItem.tag || "",
  });
  const saved = await savePostgresAnimeMetadataEntry(prisma, targetKey, normalizedItem);

  if (targetKey !== normalizedKey) {
    await prisma.anime.deleteMany({
      where: { key: normalizedKey },
    });
  }

  return compactAnimeRecord(saved);
}

async function hidePostgresAnimeMetadataEntry(key) {
  const normalizedKey = normalizeTag(key);

  if (!normalizedKey) {
    throw new Error("Anime invalido");
  }

  const prisma = getPrismaClient();
  const currentRow = await prisma.anime.findUnique({
    where: { key: normalizedKey },
    include: animeIncludeForMetadata,
  });
  const currentItem = currentRow ? compactAnimeRecord(currentRow) : {};
  const normalizedItem = normalizeEditableAnimeMetadataItem({
    ...currentItem,
    tag: currentItem.tag || key,
    title: currentItem.title || titleFromTag(currentItem.tag || key),
    libraryEnabled: false,
  });
  const saved = await savePostgresAnimeMetadataEntry(prisma, normalizedKey, normalizedItem);

  return compactAnimeRecord(saved);
}

async function deletePostgresAnimeMetadataEntry(key) {
  const normalizedKey = normalizeTag(key);

  if (!normalizedKey) {
    throw new Error("Anime invalido");
  }

  const prisma = getPrismaClient();
  await ensureAnimeCatalogs(prisma);

  const watchStatus = await prisma.animeWatchStatus.upsert({
    where: { code: "pending" },
    update: { label: "Pendiente", isActive: true },
    create: { code: "pending", label: "Pendiente" },
  });
  const trackerTag = await ensureAnimeTag(prisma, key);
  const anime = await prisma.anime.upsert({
    where: { key: normalizedKey },
    update: {},
    create: {
      key: normalizedKey,
      title: titleFromTag(key),
    },
  });

  await prisma.animeLibraryEntry.upsert({
    where: { animeId: anime.id },
    update: {
      watchStatusId: watchStatus.id,
      trackerTagId: trackerTag?.id ?? null,
      currentEpisode: null,
      purchasedEpisodes: null,
      isFullSeason: false,
      libraryEnabled: false,
      trackerUrl: null,
      deletedAt: new Date(),
    },
    create: {
      animeId: anime.id,
      watchStatusId: watchStatus.id,
      trackerTagId: trackerTag?.id ?? null,
      currentEpisode: null,
      purchasedEpisodes: null,
      isFullSeason: false,
      libraryEnabled: false,
      trackerUrl: null,
      deletedAt: new Date(),
    },
  });

  await prisma.animeExternalReference.deleteMany({
    where: { animeId: anime.id },
  });

  return readPostgresAnimeMetadata();
}

export async function getAnimeLibrary({ includeHidden = false } = {}) {
  if (!usePostgres()) {
    return buildAnimeLibrary({ includeHidden });
  }

  const metadata = await readPostgresAnimeMetadata();
  return buildAnimeLibrary({ includeHidden, metadataOverride: metadata });
}

export async function getAnimeMetadata() {
  if (!usePostgres()) {
    return readAnimeMetadata();
  }

  return readPostgresAnimeMetadata();
}

export async function upsertAnimeMetadata(key, anime) {
  if (!usePostgres()) {
    return updateAnimeMetadataEntry(key, anime);
  }

  return updatePostgresAnimeMetadataEntry(key, anime);
}

export async function hideAnimeMetadata(key) {
  if (!usePostgres()) {
    return hideAnimeMetadataEntry(key);
  }

  return hidePostgresAnimeMetadataEntry(key);
}

export async function removeAnimeMetadata(key) {
  if (!usePostgres()) {
    return deleteAnimeMetadataEntry(key);
  }

  return deletePostgresAnimeMetadataEntry(key);
}
