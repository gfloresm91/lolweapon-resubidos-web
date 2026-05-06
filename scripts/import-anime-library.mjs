import "dotenv/config";

import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import {
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

const dataDir = path.join(process.cwd(), "data");
const baseMetadataPath = path.join(dataDir, "anime-metadata.json");
const localMetadataPath = path.join(dataDir, "anime-metadata.local.json");

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveMetadataPath() {
  if (await fileExists(localMetadataPath)) {
    return localMetadataPath;
  }

  return baseMetadataPath;
}

function createPrismaClient() {
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

async function importAnimeRecord(prisma, key, item) {
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

async function main() {
  const prisma = createPrismaClient();

  try {
    const metadataPath = await resolveMetadataPath();
    const raw = await readFile(metadataPath, "utf8");
    const metadata = JSON.parse(raw);
    const entries = Object.entries(metadata);

    await ensureAnimeCatalogs(prisma);

    for (const [key, item] of entries) {
      await importAnimeRecord(prisma, key, item || {});
    }

    console.log(`Imported ${entries.length} anime records from ${path.relative(process.cwd(), metadataPath)}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
