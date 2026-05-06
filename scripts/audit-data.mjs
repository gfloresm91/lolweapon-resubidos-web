import "dotenv/config";

import { access, readFile } from "node:fs/promises";
import path from "node:path";

import {
  animeIncludeForMetadata,
  compactAnimeRecord,
} from "../lib/animeDbMapping.js";
import {
  compactLiveRecord,
  liveIncludeForData,
} from "../lib/liveDbMapping.js";
import { getPrismaClient } from "../lib/prisma.js";
import { readTagSettings } from "../lib/tagSettings.js";

const dataDir = path.join(process.cwd(), "data");
const knownWatchStatuses = new Set(["watching", "completed", "purchased", "paused", "pending", "dropped"]);
const knownTagCategories = new Set(["anime", "games", "tier", "chat", "movies", "other"]);

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveDataFile(name) {
  const localPath = path.join(dataDir, name.replace(/\.json$/, ".local.json"));
  const basePath = path.join(dataDir, name);
  return (await fileExists(localPath)) ? localPath : basePath;
}

async function readJsonFile(name, fallback) {
  const filePath = await resolveDataFile(name);

  try {
    const contents = await readFile(filePath, "utf8");
    return {
      filePath,
      data: JSON.parse(contents),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { filePath, data: fallback };
    }

    throw error;
  }
}

function normalizeTag(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeComparable(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isValidDateString(value) {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return false;
  }

  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  return !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month)
    && date.getUTCDate() === Number(day);
}

function looksLikeUrl(value) {
  if (!value) {
    return true;
  }

  if (String(value).startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function addGrouped(map, key, value) {
  if (!key) {
    return;
  }

  const items = map.get(key) || [];
  items.push(value);
  map.set(key, items);
}

function addIssue(issues, severity, scope, message) {
  issues.push({ severity, scope, message });
}

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function formatSource(source) {
  if (source.startsWith("postgres:")) {
    return source;
  }

  return path.relative(process.cwd(), source);
}

async function readPostgresSources() {
  const prisma = getPrismaClient();
  const [animeRows, liveRows, tagSettings] = await Promise.all([
    prisma.anime.findMany({
      orderBy: { key: "asc" },
      include: animeIncludeForMetadata,
    }),
    prisma.live.findMany({
      orderBy: [
        { date: "desc" },
        { id: "desc" },
      ],
      include: liveIncludeForData,
    }),
    readTagSettings(),
  ]);

  return {
    sources: {
      lives: "postgres:Live",
      animeMetadata: "postgres:Anime",
      tagSettings: "postgres:Tag/TagCategory",
    },
    lives: liveRows.map(compactLiveRecord),
    animeMetadata: Object.fromEntries(animeRows.map((row) => [row.key, compactAnimeRecord(row)])),
    tagSettings,
  };
}

async function readJsonSources() {
  const [{ filePath: livesPath, data: lives }, { filePath: animeMetadataPath, data: animeMetadata }, { filePath: tagSettingsPath, data: tagSettings }] = await Promise.all([
    readJsonFile("data.json", []),
    readJsonFile("anime-metadata.json", {}),
    readJsonFile("tag-settings.json", {}),
  ]);

  return {
    sources: {
      lives: livesPath,
      animeMetadata: animeMetadataPath,
      tagSettings: tagSettingsPath,
    },
    lives,
    animeMetadata,
    tagSettings,
  };
}

function auditAnimeMetadata(metadata, issues) {
  if (!isPlainObject(metadata)) {
    addIssue(issues, "error", "anime-metadata", "Expected an object keyed by anime metadata key.");
    return;
  }

  const tags = new Map();
  const titles = new Map();
  const providerIds = new Map();
  const trackerUrls = new Map();

  for (const [key, item] of Object.entries(metadata)) {
    const scope = `anime-metadata:${key}`;

    if (!isPlainObject(item)) {
      addIssue(issues, "error", scope, "Expected metadata entry to be an object.");
      continue;
    }

    const normalizedKey = normalizeTag(key);
    const tag = String(item.tag || "").trim();
    const title = String(item.title || "").trim();
    const titleEs = String(item.titleEs || "").trim();
    const provider = String(item.provider || "").trim();
    const providerId = item.providerId == null ? "" : String(item.providerId).trim();
    const trackerUrl = String(item.trackerUrl || "").trim();
    const watchStatus = String(item.watchStatus || "").trim();

    if (!normalizedKey) {
      addIssue(issues, "error", scope, "Metadata key is empty after normalization.");
    }

    if (key !== normalizedKey) {
      addIssue(issues, "warn", scope, `Metadata key normalizes to "${normalizedKey}".`);
    }

    if (!title && !titleEs) {
      addIssue(issues, "error", scope, "Anime has no title or custom title.");
    }

    if (!tag) {
      addIssue(issues, "warn", scope, "Anime has no tracker tag.");
    }

    if (watchStatus && !knownWatchStatuses.has(watchStatus)) {
      addIssue(issues, "error", scope, `Unknown watchStatus "${watchStatus}".`);
    }

    if ("libraryEnabled" in item && typeof item.libraryEnabled !== "boolean") {
      addIssue(issues, "warn", scope, "libraryEnabled should be boolean when present.");
    }

    if (item.providerUrl && !looksLikeUrl(item.providerUrl)) {
      addIssue(issues, "warn", scope, `providerUrl does not look valid: ${item.providerUrl}`);
    }

    if (trackerUrl && !trackerUrl.startsWith("/rastreador") && !looksLikeUrl(trackerUrl)) {
      addIssue(issues, "warn", scope, `trackerUrl does not look valid: ${trackerUrl}`);
    }

    if (watchStatus === "purchased" && String(item.purchased || "").toUpperCase() !== "ENTERA") {
      addIssue(issues, "warn", scope, "watchStatus is purchased but purchased is not ENTERA.");
    }

    if (String(item.purchased || "").toUpperCase() === "ENTERA" && watchStatus !== "purchased") {
      addIssue(issues, "warn", scope, "purchased is ENTERA but watchStatus is not purchased.");
    }

    const currentEpisode = Number(item.currentEpisode);
    const episodes = Number(item.episodes);

    if (Number.isFinite(currentEpisode) && Number.isFinite(episodes) && episodes > 0 && currentEpisode > episodes) {
      addIssue(issues, "warn", scope, `currentEpisode (${currentEpisode}) is greater than episodes (${episodes}).`);
    }

    addGrouped(tags, normalizeComparable(tag), key);
    addGrouped(titles, normalizeComparable(title || titleEs), key);

    if (provider && providerId) {
      addGrouped(providerIds, `${provider}:${providerId}`, key);
    }

    addGrouped(trackerUrls, trackerUrl, key);
  }

  for (const [tag, keys] of tags.entries()) {
    if (tag && keys.length > 1) {
      addIssue(issues, "warn", "anime-metadata", `Duplicate normalized tag "${tag}" in keys: ${keys.join(", ")}.`);
    }
  }

  for (const [title, keys] of titles.entries()) {
    if (title && keys.length > 1) {
      addIssue(issues, "warn", "anime-metadata", `Duplicate normalized title "${title}" in keys: ${keys.join(", ")}.`);
    }
  }

  for (const [providerId, keys] of providerIds.entries()) {
    if (keys.length > 1) {
      addIssue(issues, "error", "anime-metadata", `Duplicate provider/id "${providerId}" in keys: ${keys.join(", ")}.`);
    }
  }

  for (const [trackerUrl, keys] of trackerUrls.entries()) {
    if (trackerUrl && keys.length > 1) {
      addIssue(issues, "warn", "anime-metadata", `Duplicate trackerUrl "${trackerUrl}" in keys: ${keys.join(", ")}.`);
    }
  }
}

function addAnimeMetadataTags(metadata, knownTags) {
  if (!isPlainObject(metadata)) {
    return knownTags;
  }

  for (const item of Object.values(metadata)) {
    const tag = normalizeTag(item?.tag);

    if (tag) {
      knownTags.set(tag, item.tag);
    }
  }

  return knownTags;
}

function auditLives(lives, issues) {
  if (!Array.isArray(lives)) {
    addIssue(issues, "error", "lives", "Expected an array of live entries.");
    return;
  }

  const ids = new Map();
  const allTags = new Map();

  lives.forEach((live, index) => {
    const scope = `lives:${live?.id || index}`;

    if (!isPlainObject(live)) {
      addIssue(issues, "error", scope, "Expected live entry to be an object.");
      return;
    }

    const id = String(live.id || "").trim();

    if (!id) {
      addIssue(issues, "error", scope, "Live has no id.");
    }

    addGrouped(ids, id, index);

    if (!String(live.title || "").trim()) {
      addIssue(issues, "error", scope, "Live has no title.");
    }

    if (!isValidDateString(live.date)) {
      addIssue(issues, "warn", scope, `Date should use DD/MM/YYYY and be valid: ${live.date || "(empty)"}.`);
    }

    if (!String(live.year || "").trim()) {
      addIssue(issues, "warn", scope, "Live has no year.");
    }

    if (!String(live.status || "").trim()) {
      addIssue(issues, "warn", scope, "Live has no status.");
    }

    if (!Array.isArray(live.tags)) {
      addIssue(issues, "warn", scope, "Live tags should be an array.");
    } else {
      const localTags = new Map();

      for (const tag of live.tags) {
        const normalizedTag = normalizeTag(tag);

        if (!normalizedTag) {
          addIssue(issues, "warn", scope, "Live has an empty tag.");
          continue;
        }

        addGrouped(localTags, normalizedTag, tag);
        addGrouped(allTags, normalizedTag, String(tag));
      }

      for (const [tag, values] of localTags.entries()) {
        if (values.length > 1) {
          addIssue(issues, "warn", scope, `Live has duplicate tag "${tag}".`);
        }
      }
    }

    for (const [platform, links] of Object.entries(live.links || {})) {
      if (!Array.isArray(links)) {
        addIssue(issues, "warn", scope, `links.${platform} should be an array.`);
        continue;
      }

      links.forEach((link) => {
        if (!looksLikeUrl(link)) {
          addIssue(issues, "warn", scope, `links.${platform} has invalid URL: ${link}`);
        }
      });
    }
  });

  for (const [id, indexes] of ids.entries()) {
    if (id && indexes.length > 1) {
      addIssue(issues, "error", "lives", `Duplicate live id "${id}" at indexes: ${indexes.join(", ")}.`);
    }
  }

  return allTags;
}

function auditTagSettings(settings, knownLiveTags, issues) {
  if (!isPlainObject(settings)) {
    addIssue(issues, "error", "tag-settings", "Expected an object.");
    return;
  }

  const customCategoryKeys = new Set();

  if (Array.isArray(settings.categories)) {
    for (const category of settings.categories) {
      const key = String(category?.key || "").trim();
      const label = String(category?.label || "").trim();

      if (!key) {
        addIssue(issues, "warn", "tag-settings", "Custom category has no key.");
      }

      if (!label) {
        addIssue(issues, "warn", `tag-settings:${key || "category"}`, "Custom category has no label.");
      }

      if (knownTagCategories.has(key)) {
        addIssue(issues, "warn", `tag-settings:${key}`, "Custom category key collides with a built-in category.");
      }

      if (key) {
        customCategoryKeys.add(key);
      }
    }
  }

  const validCategories = new Set([...knownTagCategories, ...customCategoryKeys]);
  const overrides = isPlainObject(settings.overrides) ? settings.overrides : {};

  if (!isPlainObject(settings.overrides)) {
    addIssue(issues, "warn", "tag-settings", "overrides should be an object.");
  }

  for (const [tag, category] of Object.entries(overrides)) {
    const normalizedTag = normalizeTag(tag);

    if (tag !== normalizedTag) {
      addIssue(issues, "warn", `tag-settings:${tag}`, `Override key normalizes to "${normalizedTag}".`);
    }

    if (!validCategories.has(category)) {
      addIssue(issues, "error", `tag-settings:${tag}`, `Unknown category "${category}".`);
    }

    if (knownLiveTags && !knownLiveTags.has(normalizedTag)) {
      addIssue(issues, "warn", `tag-settings:${tag}`, "Override tag does not exist in lives data.");
    }
  }
}

function printReport(sources, issues) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warn");

  console.log("Data audit");
  console.log("==========");
  console.log(`Lives source: ${formatSource(sources.lives)}`);
  console.log(`Anime metadata source: ${formatSource(sources.animeMetadata)}`);
  console.log(`Tag settings source: ${formatSource(sources.tagSettings)}`);
  console.log("");
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log("");

  if (!issues.length) {
    console.log("No issues found.");
    return;
  }

  for (const issue of issues) {
    const label = issue.severity === "error" ? "ERROR" : "WARN ";
    console.log(`[${label}] ${issue.scope}: ${issue.message}`);
  }
}

async function main() {
  const issues = [];
  const { sources, lives, animeMetadata, tagSettings } = usePostgres()
    ? await readPostgresSources()
    : await readJsonSources();

  const knownTags = auditLives(lives, issues);
  auditAnimeMetadata(animeMetadata, issues);
  auditTagSettings(tagSettings, addAnimeMetadataTags(animeMetadata, knownTags), issues);
  printReport(sources, issues);

  if (issues.some((issue) => issue.severity === "error")) {
    process.exitCode = 1;
  }

  if (usePostgres()) {
    await getPrismaClient().$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
