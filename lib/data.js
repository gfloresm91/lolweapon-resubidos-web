import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeLives } from "@/lib/lives";

const dataDir = path.join(process.cwd(), "data");
const baseDataFile = path.join(dataDir, "data.json");
const localDataFile = path.join(dataDir, "data.local.json");

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveReadPath() {
  if (await fileExists(localDataFile)) {
    return localDataFile;
  }

  return baseDataFile;
}

async function resolveWritePath() {
  if (await fileExists(localDataFile)) {
    return localDataFile;
  }

  return baseDataFile;
}

export async function readLives() {
  try {
    const filePath = await resolveReadPath();
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents);
    return normalizeLives(parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function writeLives(lives) {
  await mkdir(dataDir, { recursive: true });
  const filePath = await resolveWritePath();
  await writeFile(filePath, JSON.stringify(normalizeLives(lives), null, 2), "utf8");
}
