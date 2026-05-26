import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readSpaceDrumLibrary } from "../lib/repositories/spaceDrumRepository.js";

const dataDir = path.join(process.cwd(), "data");
const exportPath = path.join(dataDir, "spacedrum.export.json");

async function main() {
  const data = await readSpaceDrumLibrary();
  const chapters = Object.values(data.languages || {}).reduce((sum, language) => sum + language.chapters.length, 0);

  await mkdir(dataDir, { recursive: true });
  await writeFile(exportPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Exported SpaceDrum with ${chapters} chapters to ${path.relative(process.cwd(), exportPath)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
