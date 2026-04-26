import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeTag, TAG_CATEGORIES } from "@/lib/tags";

const dataDir = path.join(process.cwd(), "data");
const baseSettingsFile = path.join(dataDir, "tag-settings.json");
const localSettingsFile = path.join(dataDir, "tag-settings.local.json");

function normalizeCategorySlug(label) {
  return String(label || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveReadPath() {
  if (await fileExists(localSettingsFile)) {
    return localSettingsFile;
  }

  return baseSettingsFile;
}

async function resolveWritePath() {
  if (await fileExists(localSettingsFile)) {
    return localSettingsFile;
  }

  return baseSettingsFile;
}

function normalizeCustomCategory(category, existingKeys) {
  const label = String(category?.label || "").trim();

  if (!label) {
    return null;
  }

  const providedKey = String(category?.key || "").trim();
  const baseKey = normalizeCategorySlug(providedKey.replace(/^custom-/, "") || label) || "categoria";
  let key = providedKey.startsWith("custom-") ? providedKey : `custom-${baseKey}`;
  let index = 2;

  while (existingKeys.has(key)) {
    key = `custom-${baseKey}-${index}`;
    index += 1;
  }

  existingKeys.add(key);

  return {
    key,
    label,
    icon: String(category?.icon || "🏷️").trim() || "🏷️",
    keywords: [],
    custom: true,
  };
}

export function normalizeTagSettings(settings) {
  const baseKeys = new Set(TAG_CATEGORIES.map((category) => category.key));
  const existingKeys = new Set(baseKeys);
  const categories = Array.isArray(settings?.categories)
    ? settings.categories
        .map((category) => normalizeCustomCategory(category, existingKeys))
        .filter(Boolean)
    : [];
  const validCategoryKeys = new Set([...baseKeys, ...categories.map((category) => category.key)]);
  const overrides = {};

  if (settings?.overrides && typeof settings.overrides === "object") {
    for (const [tag, categoryKey] of Object.entries(settings.overrides)) {
      const normalizedTag = normalizeTag(tag);

      if (normalizedTag && validCategoryKeys.has(categoryKey)) {
        overrides[normalizedTag] = categoryKey;
      }
    }
  }

  return { categories, overrides };
}

export async function readTagSettings() {
  try {
    const filePath = await resolveReadPath();
    const contents = await readFile(filePath, "utf8");
    return normalizeTagSettings(JSON.parse(contents));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { categories: [], overrides: {} };
    }

    throw error;
  }
}

export async function writeTagSettings(settings) {
  await mkdir(dataDir, { recursive: true });
  const filePath = await resolveWritePath();
  const normalizedSettings = normalizeTagSettings(settings);
  await writeFile(filePath, JSON.stringify(normalizedSettings, null, 2), "utf8");
  return normalizedSettings;
}
