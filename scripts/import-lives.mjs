import "dotenv/config";

import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { ensureAnimeCatalogs } from "../lib/animeDbMapping.js";
import { ensureLiveCatalogs, saveLiveRecord } from "../lib/liveDbMapping.js";
import { normalizeLives } from "../lib/lives.js";

const dataDir = path.join(process.cwd(), "data");
const baseDataPath = path.join(dataDir, "data.json");
const localDataPath = path.join(dataDir, "data.local.json");

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveDataPath() {
  if (await fileExists(localDataPath)) {
    return localDataPath;
  }

  return baseDataPath;
}

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
    const dataPath = await resolveDataPath();
    const raw = await readFile(dataPath, "utf8");
    const lives = normalizeLives(JSON.parse(raw));

    await ensureAnimeCatalogs(prisma);
    await ensureLiveCatalogs(prisma);

    for (const live of lives) {
      await saveLiveRecord(prisma, live);
    }

    console.log(`Imported ${lives.length} live records from ${path.relative(process.cwd(), dataPath)}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
