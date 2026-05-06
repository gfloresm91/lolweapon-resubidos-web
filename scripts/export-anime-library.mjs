import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { animeIncludeForMetadata, compactAnimeRecord } from "../lib/animeDbMapping.js";

const dataDir = path.join(process.cwd(), "data");
const exportPath = path.join(dataDir, "anime-metadata.export.json");

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const rows = await prisma.anime.findMany({
      where: {
        OR: [
          { libraryEntry: null },
          { libraryEntry: { deletedAt: null } },
        ],
      },
      orderBy: { key: "asc" },
      include: animeIncludeForMetadata,
    });
    const metadata = Object.fromEntries(rows.map((row) => [row.key, compactAnimeRecord(row)]));

    await mkdir(dataDir, { recursive: true });
    await writeFile(exportPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    console.log(`Exported ${rows.length} anime records to ${path.relative(process.cwd(), exportPath)}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
