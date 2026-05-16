import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ensureAnimeCatalogs } from "./animeDbMapping.js";
import { getPrismaClient } from "./prisma.js";
import { safeUpsert } from "./prismaSafeUpsert.js";
import { categorizeTag, normalizeRuleItems, normalizeTag, TAG_CATEGORIES } from "./tags.js";

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

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
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
    exact: normalizeRuleItems(category?.exact),
    keywords: normalizeRuleItems(category?.keywords),
    custom: true,
  };
}

function compactCategory(category) {
  return {
    key: category.code,
    label: category.label,
    icon: category.icon || "TG",
    exact: normalizeRuleItems(category.exact),
    keywords: normalizeRuleItems(category.keywords),
    custom: category.isCustom,
  };
}

function getDefaultRuleCategories(customCategories = []) {
  const otherCategory = TAG_CATEGORIES.find((category) => category.key === "other");
  return [
    ...TAG_CATEGORIES.filter((category) => category.key !== "other"),
    ...customCategories,
    otherCategory,
  ].filter(Boolean);
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

async function readJsonTagSettings() {
  try {
    const filePath = await resolveReadPath();
    const contents = await readFile(filePath, "utf8");
    const normalizedSettings = normalizeTagSettings(JSON.parse(contents));
    return { ...normalizedSettings, ruleCategories: getDefaultRuleCategories(normalizedSettings.categories) };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { categories: [], overrides: {}, ruleCategories: getDefaultRuleCategories([]) };
    }

    throw error;
  }
}

async function writeJsonTagSettings(settings) {
  await mkdir(dataDir, { recursive: true });
  const filePath = await resolveWritePath();
  const normalizedSettings = normalizeTagSettings(settings);
  await writeFile(filePath, JSON.stringify(normalizedSettings, null, 2), "utf8");
  return { ...normalizedSettings, ruleCategories: getDefaultRuleCategories(normalizedSettings.categories) };
}

async function readPostgresTagSettings() {
  const prisma = getPrismaClient();
  await ensureAnimeCatalogs(prisma);
  await backfillAnimeLibraryTagCategories(prisma);

  const customCategories = await prisma.tagCategory.findMany({
    where: {
      isCustom: true,
      isActive: true,
    },
    orderBy: [
      { sortOrder: "asc" },
      { label: "asc" },
      { id: "asc" },
    ],
  });
  const tags = await prisma.tag.findMany({
    where: {
      category: {
        isActive: true,
      },
    },
    include: {
      category: true,
    },
    orderBy: {
      slug: "asc",
    },
  });
  const categories = customCategories.map((category) => ({
    key: category.code,
    label: category.label,
    icon: category.icon || "🏷️",
    exact: normalizeRuleItems(category.exact),
    keywords: normalizeRuleItems(category.keywords),
    custom: true,
  }));
  const allCategories = await prisma.tagCategory.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      { sortOrder: "asc" },
      { label: "asc" },
      { id: "asc" },
    ],
  });
  const ruleCategories = allCategories.map(compactCategory);
  const validCategoryKeys = new Set([
    ...TAG_CATEGORIES.map((category) => category.key),
    ...categories.map((category) => category.key),
  ]);
  const overrides = {};

  for (const tag of tags) {
    const automaticCategory = categorizeTag(tag.name || tag.slug, {}, ruleCategories);

    if (tag.slug && tag.category?.code && validCategoryKeys.has(tag.category.code) && tag.category.code !== automaticCategory) {
      overrides[tag.slug] = tag.category.code;
    }
  }

  return { categories, overrides, ruleCategories };
}

async function backfillAnimeLibraryTagCategories(prisma) {
  const animeIcon = TAG_CATEGORIES.find((category) => category.key === "anime")?.icon || "🏷️";
  const animeCategory = await safeUpsert(prisma.tagCategory, {
    where: { code: "anime" },
    update: { label: "Anime", icon: animeIcon, isCustom: false, isActive: true, sortOrder: 10 },
    create: { code: "anime", label: "Anime", icon: animeIcon, isCustom: false, isActive: true, sortOrder: 10 },
  });

  await prisma.tag.updateMany({
    where: {
      categoryId: null,
      animeLibraryEntries: {
        some: {},
      },
    },
    data: {
      categoryId: animeCategory.id,
    },
  });
}

async function writePostgresTagSettings(settings) {
  const prisma = getPrismaClient();
  const normalizedSettings = normalizeTagSettings(settings);
  const customCategoryCodes = normalizedSettings.categories.map((category) => category.key);

  await ensureAnimeCatalogs(prisma);
  await backfillAnimeLibraryTagCategories(prisma);

  for (const [index, category] of normalizedSettings.categories.entries()) {
    await safeUpsert(prisma.tagCategory, {
      where: { code: category.key },
      update: {
        label: category.label,
        icon: category.icon || "🏷️",
        exact: normalizeRuleItems(category.exact),
        keywords: normalizeRuleItems(category.keywords),
        isCustom: true,
        isActive: true,
        sortOrder: 1000 + index,
      },
      create: {
        code: category.key,
        label: category.label,
        icon: category.icon || "🏷️",
        exact: normalizeRuleItems(category.exact),
        keywords: normalizeRuleItems(category.keywords),
        isCustom: true,
        isActive: true,
        sortOrder: 1000 + index,
      },
    });
  }

  await prisma.tagCategory.updateMany({
    where: {
      isCustom: true,
      code: {
        notIn: customCategoryCodes,
      },
    },
    data: {
      isActive: false,
    },
  });

  if (settings?.overrides && typeof settings.overrides === "object") {
    const overrideTags = Object.keys(normalizedSettings.overrides);
    await prisma.tag.updateMany({
      where: {
        slug: {
          notIn: overrideTags,
        },
        lives: {
          some: {},
        },
      },
      data: {
        categoryId: null,
      },
    });

    for (const [tagSlug, categoryCode] of Object.entries(normalizedSettings.overrides)) {
      const category = await prisma.tagCategory.findUnique({
        where: { code: categoryCode },
      });

      if (!category) {
        continue;
      }

      await safeUpsert(prisma.tag, {
        where: { slug: tagSlug },
        update: {
          categoryId: category.id,
        },
        create: {
          name: tagSlug,
          slug: tagSlug,
          categoryId: category.id,
        },
      });
    }
  }

  if (Array.isArray(settings?.categoryRules)) {
    for (const category of settings.categoryRules) {
      const key = String(category?.key || "").trim();

      if (!key) {
        continue;
      }

      await prisma.tagCategory.updateMany({
        where: {
          code: key,
          isActive: true,
        },
        data: {
          label: String(category?.label || key).trim() || key,
          icon: String(category?.icon || "TG").trim() || "TG",
          exact: normalizeRuleItems(category?.exact),
          keywords: normalizeRuleItems(category?.keywords),
        },
      });
    }
  }

  return readPostgresTagSettings();
}

export async function readTagSettings() {
  if (!usePostgres()) {
    return readJsonTagSettings();
  }

  return readPostgresTagSettings();
}

export async function writeTagSettings(settings) {
  if (!usePostgres()) {
    return writeJsonTagSettings(settings);
  }

  return writePostgresTagSettings(settings);
}

export async function syncTagSettingsWithLives(lives) {
  if (!usePostgres()) {
    await mkdir(dataDir, { recursive: true });
  }

  const currentSettings = await readTagSettings();
  const categories = currentSettings.ruleCategories || getDefaultRuleCategories(currentSettings.categories);
  const nextOverrides = {};
  const tagsByNormalizedKey = new Map();

  for (const live of lives || []) {
    for (const tag of live?.tags || []) {
      const normalizedTag = normalizeTag(tag);

      if (normalizedTag && !tagsByNormalizedKey.has(normalizedTag)) {
        tagsByNormalizedKey.set(normalizedTag, tag);
      }
    }
  }

  for (const [normalizedTag, originalTag] of [...tagsByNormalizedKey.entries()].sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    if (currentSettings.overrides[normalizedTag]) {
      nextOverrides[normalizedTag] = currentSettings.overrides[normalizedTag];
    }
  }

  return writeTagSettings({
    categories: currentSettings.categories,
    overrides: nextOverrides,
    categoryRules: currentSettings.ruleCategories,
  });
}
