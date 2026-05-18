import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const TABLES_WITH_AUTO_IDS = [
  "Anime",
  "AnimeLibraryEntry",
  "AnimeExternalReference",
  "ExternalProvider",
  "AnimeFormat",
  "AnimeReleaseStatus",
  "AnimeWatchStatus",
  "TagCategory",
  "Tag",
  "Live",
  "LiveStatus",
  "LiveLink",
  "LinkPlatform",
  "SpaceDrum",
  "SpaceDrumMeta",
  "SpaceDrumLink",
  "SpaceDrumChapter",
  "SpaceDrumPage",
  "PlatformRole",
  "PlatformPermission",
  "PlatformUser",
  "PlatformUserLive",
  "PlatformUserAnime",
  "PlatformSession",
  "LoginAttempt",
];

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

async function resetTableSequence(prisma, tableName) {
  const table = quoteIdentifier(tableName);
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('${table}', 'id'),
      COALESCE((SELECT MAX("id") + 1 FROM ${table}), 1),
      false
    )
  `);
}

async function main() {
  const prisma = createPrismaClient();

  try {
    for (const tableName of TABLES_WITH_AUTO_IDS) {
      await resetTableSequence(prisma, tableName);
      console.log(`Sequence reset for ${tableName}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
