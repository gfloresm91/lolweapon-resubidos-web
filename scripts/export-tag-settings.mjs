import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readTagSettings } from "../lib/tagSettings.js";

const dataDir = path.join(process.cwd(), "data");
const exportPath = path.join(dataDir, "tag-settings.export.json");

async function main() {
  const settings = await readTagSettings();

  await mkdir(dataDir, { recursive: true });
  await writeFile(exportPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  console.log(
    `Exported ${Object.keys(settings.overrides || {}).length} tag overrides and ${settings.categories.length} custom categories to ${path.relative(process.cwd(), exportPath)}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
