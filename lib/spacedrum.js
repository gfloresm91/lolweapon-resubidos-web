import { access, readFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const baseDataFile = path.join(dataDir, "spacedrum.json");
const localDataFile = path.join(dataDir, "spacedrum.local.json");

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

function toString(value) {
  return String(value || "").trim();
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .map((link) => ({
      label: toString(link?.label),
      url: toString(link?.url),
    }))
    .filter((link) => link.label && link.url);
}

function normalizePages(pages) {
  if (!Array.isArray(pages)) {
    return [];
  }

  return pages
    .map((page, index) => ({
      image: toString(page?.image),
      alt: toString(page?.alt) || `Página ${index + 1}`,
    }))
    .filter((page) => page.image);
}

function normalizeChapters(chapters) {
  if (!Array.isArray(chapters)) {
    return [];
  }

  return chapters
    .map((chapter, index) => ({
      id: toString(chapter?.id) || `chapter-${index + 1}`,
      title: toString(chapter?.title) || `Capítulo ${index + 1}`,
      releaseDate: toString(chapter?.releaseDate),
      summary: toString(chapter?.summary),
      pages: normalizePages(chapter?.pages),
    }))
    .filter((chapter) => chapter.pages.length > 0);
}

function normalizeMeta(meta) {
  if (!Array.isArray(meta)) {
    return [];
  }

  return meta
    .map((item) => ({
      label: toString(item?.label),
      value: toString(item?.value),
    }))
    .filter((item) => item.label && item.value);
}

export function normalizeSpaceDrum(data) {
  return {
    title: toString(data?.title) || "SpaceDrum",
    subtitle: toString(data?.subtitle),
    status: toString(data?.status),
    coverImage: toString(data?.coverImage),
    heroImage: toString(data?.heroImage),
    description: toString(data?.description),
    meta: normalizeMeta(data?.meta),
    links: normalizeLinks(data?.links),
    chapters: normalizeChapters(data?.chapters),
  };
}

export async function readSpaceDrum() {
  try {
    const filePath = await resolveReadPath();
    const contents = await readFile(filePath, "utf8");
    return normalizeSpaceDrum(JSON.parse(contents));
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizeSpaceDrum({});
    }

    throw error;
  }
}
