import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
} from "../lib/animeDbMapping.js";

export function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

function toAnimeTitle(key, item) {
  const title = toTrimmedString(item?.title || item?.titleEs || item?.tag || key);
  return title || key;
}

async function upsertExternalReference(prisma, animeId, item) {
  const provider = await ensureExternalProvider(prisma, item.provider);

  if (!provider) {
    await prisma.animeExternalReference.deleteMany({ where: { animeId } });
    return;
  }

  await prisma.animeExternalReference.upsert({
    where: {
      animeId_providerId: {
        animeId,
        providerId: provider.id,
      },
    },
    update: {
      providerMediaId: toNullableInt(item.providerId),
      url: toNullableString(item.providerUrl),
    },
    create: {
      animeId,
      providerId: provider.id,
      providerMediaId: toNullableInt(item.providerId),
      url: toNullableString(item.providerUrl),
    },
  });
}

export async function readPostgresAnimeMetadata(prisma) {
  const rows = await prisma.anime.findMany({
    orderBy: { key: "asc" },
    include: animeIncludeForMetadata,
  });

  return Object.fromEntries(rows.map((row) => [row.key, compactAnimeRecord(row)]));
}

export async function saveAnimeRecord(prisma, key, item) {
  await ensureAnimeCatalogs(prisma);

  const format = await ensureAnimeFormat(prisma, item.format);
  const releaseStatus = await ensureAnimeReleaseStatus(prisma, item.status);
  const trackerTag = await ensureAnimeTag(prisma, item.tag);
  const isFullSeason = getIsFullSeason(item);
  const watchStatusCode = isFullSeason ? "purchased" : toTrimmedString(item.watchStatus) || "pending";
  const watchStatus = await prisma.animeWatchStatus.upsert({
    where: { code: watchStatusCode },
    update: { label: watchStatusCode, isActive: true },
    create: { code: watchStatusCode, label: watchStatusCode },
  });
  const anime = await prisma.anime.upsert({
    where: { key },
    update: {
      title: toAnimeTitle(key, item),
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
      title: toAnimeTitle(key, item),
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

  await upsertExternalReference(prisma, anime.id, item);
}
