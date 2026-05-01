import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { readLives } from "@/lib/data";
import { normalizeTag } from "@/lib/tags";
import { readTagSettings } from "@/lib/tagSettings";

const dataDir = path.join(process.cwd(), "data");
const baseMetadataFile = path.join(dataDir, "anime-metadata.json");
const localMetadataFile = path.join(dataDir, "anime-metadata.local.json");

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveReadPath() {
  if (await fileExists(localMetadataFile)) {
    return localMetadataFile;
  }

  return baseMetadataFile;
}

async function resolveWritePath() {
  if (await fileExists(localMetadataFile)) {
    return localMetadataFile;
  }

  return baseMetadataFile;
}

function parseDateValue(value) {
  const [day = "01", month = "01", year = "1900"] = String(value || "").split("/");
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function titleFromTag(tag) {
  return String(tag || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparable(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function readAnimeMetadata() {
  try {
    const filePath = await resolveReadPath();
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function normalizeEditableAnimeMetadataItem(item) {
  return {
    tag: String(item?.tag || "").trim(),
    title: String(item?.title || "").trim(),
    titleEs: String(item?.titleEs || "").trim(),
    image: String(item?.image || "").trim(),
    description: String(item?.description || "").trim(),
    descriptionEs: String(item?.descriptionEs || "").trim(),
    provider: String(item?.provider || "").trim(),
    providerId: item?.providerId ? Number(item.providerId) : null,
    providerUrl: String(item?.providerUrl || "").trim(),
    trackerUrl: String(item?.trackerUrl || "").trim(),
    year: item?.year ? Number(item.year) : null,
    episodes: item?.episodes ? Number(item.episodes) : null,
    currentEpisode: String(item?.currentEpisode || "").trim(),
    purchased: String(item?.purchased || "").trim(),
    format: String(item?.format || "").trim(),
    status: String(item?.status || "").trim(),
    watchStatus: String(item?.watchStatus || "pending").trim() || "pending",
    libraryEnabled: item?.libraryEnabled === false ? false : true,
  };
}

export async function writeAnimeMetadata(metadata) {
  await mkdir(dataDir, { recursive: true });
  const filePath = await resolveWritePath();
  await writeFile(filePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadata;
}

export async function updateAnimeMetadataEntry(key, nextItem) {
  const normalizedKey = normalizeTag(key || nextItem?.tag || nextItem?.title || nextItem?.titleEs);

  if (!normalizedKey) {
    throw new Error("Tag invalido");
  }

  const metadata = await readAnimeMetadata();
  const incomingAliases = [
    nextItem?.tag,
    nextItem?.title,
    nextItem?.titleEs,
  ].map(normalizeComparable).filter(Boolean);
  const existingKey = metadata[normalizedKey]
    ? normalizedKey
    : Object.entries(metadata).find(([, item]) => {
        return [
          item?.tag,
          item?.title,
          item?.titleEs,
        ].map(normalizeComparable).some((alias) => alias && incomingAliases.includes(alias));
      })?.[0];
  const targetKey = existingKey || normalizedKey;
  const currentItem = metadata[targetKey] || {};
  const normalizedItem = normalizeEditableAnimeMetadataItem({
    ...currentItem,
    ...nextItem,
    tag: nextItem?.tag || currentItem.tag || key || nextItem?.title,
  });

  metadata[targetKey] = normalizedItem;

  if (targetKey !== normalizedKey && metadata[normalizedKey]) {
    delete metadata[normalizedKey];
  }

  await writeAnimeMetadata(metadata);
  return normalizedItem;
}

function getLibraryAliases(item) {
  return [
    item.key,
    item.tag,
    item.title,
    item.titleEs,
  ].map(normalizeComparable).filter(Boolean);
}

function mergeLibraryItems(current, next) {
  const currentDate = parseDateValue(current.lastDate);
  const nextDate = parseDateValue(next.lastDate);

  return {
    ...current,
    ...next,
    image: current.image || next.image,
    description: current.description || next.description,
    descriptionEs: current.descriptionEs || next.descriptionEs,
    provider: current.provider || next.provider,
    providerId: current.providerId || next.providerId,
    providerUrl: current.providerUrl || next.providerUrl,
    trackerUrl: current.trackerUrl || next.trackerUrl,
    year: current.year || next.year,
    episodes: current.episodes || next.episodes,
    currentEpisode: current.currentEpisode || next.currentEpisode,
    purchased: current.purchased || next.purchased,
    format: current.format || next.format,
    status: current.status || next.status,
    watchStatus: current.watchStatus !== "pending" ? current.watchStatus : next.watchStatus,
    resubidosCount: Math.max(current.resubidosCount || 0, next.resubidosCount || 0),
    lastDate: nextDate > currentDate ? next.lastDate : current.lastDate,
  };
}

export async function buildAnimeLibrary() {
  const [lives, settings, metadata] = await Promise.all([
    readLives(),
    readTagSettings(),
    readAnimeMetadata(),
  ]);
  const animeTagKeys = new Set(
    Object.entries(settings.overrides || {})
      .filter(([, category]) => category === "anime")
      .map(([tag]) => tag),
  );
  const tagStats = new Map();

  for (const live of lives) {
    for (const tag of live.tags || []) {
      const key = normalizeTag(tag);

      if (!animeTagKeys.has(key)) {
        continue;
      }

      const current = tagStats.get(key) || {
        tag,
        count: 0,
        lastDate: "",
        lastSortDate: "",
      };
      const sortDate = parseDateValue(live.date);

      current.count += 1;

      if (!current.lastSortDate || sortDate > current.lastSortDate) {
        current.lastDate = live.date || "";
        current.lastSortDate = sortDate;
      }

      tagStats.set(key, current);
    }
  }

  const libraryKeys = new Set([
    ...tagStats.keys(),
    ...Object.entries(metadata)
      .filter(([, item]) => item?.libraryEnabled !== false)
      .map(([key]) => key),
  ]);

  const rawLibrary = [...libraryKeys]
    .map((key) => {
      const stats = tagStats.get(key) || {
        tag: metadata[key]?.tag || key,
        count: 0,
        lastDate: "",
        lastSortDate: "",
      };
      const item = metadata[key] || {};
      const tag = item.tag || stats.tag;

      if (item.libraryEnabled === false) {
        return null;
      }

      return {
        key,
        tag,
        title: item.title || titleFromTag(tag),
        titleEs: item.titleEs || "",
        image: item.image || "",
        description: item.description || "",
        descriptionEs: item.descriptionEs || "",
        provider: item.provider || "",
        providerId: item.providerId || null,
        providerUrl: item.providerUrl || "",
        trackerUrl: item.trackerUrl || `/rastreador?tag=${encodeURIComponent(tag)}`,
        year: item.year || null,
        episodes: item.episodes || null,
        currentEpisode: item.currentEpisode || "",
        purchased: item.purchased || "",
        format: item.format || "",
        status: item.status || "",
        watchStatus: item.watchStatus || "pending",
        resubidosCount: stats.count,
        lastDate: stats.lastDate,
      };
    })
    .filter(Boolean);
  const deduped = [];
  const aliasToIndex = new Map();

  for (const item of rawLibrary) {
    const aliases = getLibraryAliases(item);
    const existingIndex = aliases
      .map((alias) => aliasToIndex.get(alias))
      .find((index) => index !== undefined);

    if (existingIndex === undefined) {
      const nextIndex = deduped.length;
      deduped.push(item);
      for (const alias of aliases) {
        aliasToIndex.set(alias, nextIndex);
      }
      continue;
    }

    deduped[existingIndex] = mergeLibraryItems(deduped[existingIndex], item);
    for (const alias of getLibraryAliases(deduped[existingIndex])) {
      aliasToIndex.set(alias, existingIndex);
    }
  }

  return deduped
    .sort((left, right) => left.title.localeCompare(right.title));
}
