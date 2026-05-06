import "dotenv/config";

import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { writeTagSettings } from "../lib/tagSettings.js";

const dataDir = path.join(process.cwd(), "data");
const baseSettingsPath = path.join(dataDir, "tag-settings.json");
const localSettingsPath = path.join(dataDir, "tag-settings.local.json");

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveSettingsPath() {
  if (await fileExists(localSettingsPath)) {
    return localSettingsPath;
  }

  return baseSettingsPath;
}

async function main() {
  const settingsPath = await resolveSettingsPath();
  const raw = await readFile(settingsPath, "utf8");
  const settings = await writeTagSettings(JSON.parse(raw));

  console.log(
    `Imported ${Object.keys(settings.overrides || {}).length} tag overrides and ${settings.categories.length} custom categories from ${path.relative(process.cwd(), settingsPath)}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
