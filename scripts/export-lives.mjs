import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { compactLiveRecord, liveIncludeForData } from "../lib/liveDbMapping.js";
import { sortLives } from "../lib/lives.js";

const dataDir = path.join(process.cwd(), "data");
const exportPath = path.join(dataDir, "data.export.json");

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
    const rows = await prisma.live.findMany({
      orderBy: [
        { date: "desc" },
        { id: "desc" },
      ],
      include: liveIncludeForData,
    });
    const lives = sortLives(rows.map(compactLiveRecord));

    await mkdir(dataDir, { recursive: true });
    await writeFile(exportPath, `${JSON.stringify(lives, null, 2)}\n`, "utf8");
    console.log(`Exported ${lives.length} live records to ${path.relative(process.cwd(), exportPath)}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
