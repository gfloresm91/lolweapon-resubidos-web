import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeAnimes, sortAnimes } from "@/lib/animes";

const dataDir = path.join(process.cwd(), "data");
const baseDataFile = path.join(dataDir, "animes.json");
const localDataFile = path.join(dataDir, "animes.local.json");

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

export async function readAnimes() {
  try {
    const filePath = await resolveReadPath();
    const contents = await readFile(filePath, "utf8");
    return normalizeAnimes(JSON.parse(contents));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function writeAnimes(animes) {
  await mkdir(dataDir, { recursive: true });
  const filePath = await resolveWritePath();
  await writeFile(filePath, JSON.stringify(sortAnimes(animes), null, 2), "utf8");
}

