import { access, readFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const baseDataFile = path.join(dataDir, "spacedrum.json");
const localDataFile = path.join(dataDir, "spacedrum.local.json");

export const SPACE_DRUM_LANGUAGES = [
  { code: "es-es", label: "Español", shortLabel: "ES", chapterLabel: "Ciclo" },
  { code: "en-us", label: "English", shortLabel: "EN", chapterLabel: "Cycle" },
];

export const DEFAULT_SPACE_DRUM_LANGUAGE = "es-es";
const SPACE_DRUM_ASSET_BASE_URL = "https://spacedrum-worker.lolweapons.workers.dev/assets";
const SPACE_DRUM_GENERIC_DESCRIPTIONS = new Set([
  "Lee SpaceDrum por ciclos, con capítulos disponibles en español e inglés.",
  "Read SpaceDrum by cycles, with chapters available in English and Spanish.",
]);

const SPACE_DRUM_DEFAULTS = {
  "es-es": {
    subtitle: "Manga oficial de SpaceDrum",
    status: "Lectura disponible",
    coverImage: `${SPACE_DRUM_ASSET_BASE_URL}/spacedrum_logo.png`,
    heroImage: `${SPACE_DRUM_ASSET_BASE_URL}/background.jpg`,
    description:
      "RENACIMIENTO, VIDA, MUERTE, DESINTEGRACIÓN ASTRAL.\nRENACIMIENTO, VIDA, MUERTE, DESINTEGRACIÓN ASTRAL.\nRENACIMIENTO, VIDA, MUERTE, DESINTEGRACIÓN ASTRAL.\n\nTodos los seres del firmamento viven encerrados en este ciclo infinito.\nO así era hasta el día en el que ellas bajaron desde los cielos.\nLa humanidad dejó de ser humana.\nLa muerte dejó de ser el final.\n\nLa iluminación llegó para salvar a sus hijos y derrotar al sentimiento más poderoso que la conciencia había podido crear.",
    links: [
      { label: "Sitio original", url: "https://mangaspacedrum.com/#/" },
      { label: "Guion: YouTube", url: "https://www.youtube.com/@Lolweapon" },
      { label: "Guion: Instagram", url: "https://www.instagram.com/kalathras_lolweapon/" },
      { label: "Guion: Twitch", url: "https://www.twitch.tv/kalathraslolweapon" },
      { label: "Arte: X", url: "https://twitter.com/ArtSoritha" },
      { label: "Arte: Instagram", url: "https://www.instagram.com/soritha_art/" },
      { label: "Comprar en Buscalibre", url: "https://www.buscalibre.cl/libros/search?q=spacedrum" },
      { label: "Comprar tomo", url: "https://amzn.to/3J2Gdfh" },
    ],
  },
  "en-us": {
    subtitle: "Official SpaceDrum manga",
    status: "Available to read",
    coverImage: `${SPACE_DRUM_ASSET_BASE_URL}/spacedrum_logo.png`,
    heroImage: `${SPACE_DRUM_ASSET_BASE_URL}/background.jpg`,
    description:
      "REBIRTH, LIFE, DEATH, ASTRAL DISINTEGRATION.\nREBIRTH, LIFE, DEATH, ASTRAL DISINTEGRATION.\nREBIRTH, LIFE, DEATH, ASTRAL DISINTEGRATION.\n\nAll beings in the firmament live trapped inside this infinite cycle.\nOr so it was until the day they descended from the heavens.\nHumanity stopped being human.\nDeath stopped being the end.\n\nEnlightenment arrived to save its children and defeat the most powerful feeling consciousness had ever created.",
    links: [
      { label: "Original site", url: "https://mangaspacedrum.com/#/" },
      { label: "Script: YouTube", url: "https://www.youtube.com/@Lolweapon" },
      { label: "Script: Instagram", url: "https://www.instagram.com/kalathras_lolweapon/" },
      { label: "Script: Twitch", url: "https://www.twitch.tv/kalathraslolweapon" },
      { label: "Art: X", url: "https://twitter.com/ArtSoritha" },
      { label: "Art: Instagram", url: "https://www.instagram.com/soritha_art/" },
      { label: "Buy on Buscalibre", url: "https://www.buscalibre.cl/libros/search?q=spacedrum" },
      { label: "Buy volume", url: "https://amzn.to/3J2Gdfh" },
    ],
  },
};

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

function mergeLinks(links, defaultLinks) {
  const normalizedLinks = normalizeLinks(links);
  const urls = new Set(normalizedLinks.map((link) => link.url));

  for (const link of defaultLinks) {
    if (!urls.has(link.url)) {
      normalizedLinks.push(link);
      urls.add(link.url);
    }
  }

  return normalizedLinks;
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

function normalizeLanguage(value) {
  const normalized = toString(value).toLowerCase();
  return SPACE_DRUM_LANGUAGES.some((language) => language.code === normalized)
    ? normalized
    : DEFAULT_SPACE_DRUM_LANGUAGE;
}

function normalizeChapters(chapters, language = DEFAULT_SPACE_DRUM_LANGUAGE) {
  if (!Array.isArray(chapters)) {
    return [];
  }

  return chapters
    .map((chapter, index) => ({
      id: toString(chapter?.id) || `chapter-${index + 1}`,
      title: toString(chapter?.title) || `Capítulo ${index + 1}`,
      releaseDate: toString(chapter?.releaseDate),
      summary: toString(chapter?.summary),
      language: normalizeLanguage(chapter?.language || language),
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

export function normalizeSpaceDrum(data, language = DEFAULT_SPACE_DRUM_LANGUAGE) {
  const normalizedLanguage = normalizeLanguage(data?.language || language);
  const defaults = SPACE_DRUM_DEFAULTS[normalizedLanguage] || SPACE_DRUM_DEFAULTS[DEFAULT_SPACE_DRUM_LANGUAGE];
  const description = toString(data?.description);

  return {
    language: normalizedLanguage,
    title: toString(data?.title) || "SpaceDrum",
    subtitle: toString(data?.subtitle) || defaults.subtitle,
    status: toString(data?.status) || defaults.status,
    coverImage: toString(data?.coverImage) || defaults.coverImage,
    heroImage: toString(data?.heroImage) || defaults.heroImage,
    description: !description || SPACE_DRUM_GENERIC_DESCRIPTIONS.has(description) ? defaults.description : description,
    meta: normalizeMeta(data?.meta),
    links: mergeLinks(data?.links, defaults.links),
    chapters: normalizeChapters(data?.chapters, normalizedLanguage),
  };
}

export function normalizeSpaceDrumLibrary(data) {
  if (data?.languages && typeof data.languages === "object") {
    const languages = {};

    for (const language of SPACE_DRUM_LANGUAGES) {
      languages[language.code] = normalizeSpaceDrum(data.languages[language.code], language.code);
    }

    return {
      defaultLanguage: normalizeLanguage(data.defaultLanguage),
      languages,
    };
  }

  const fallbackLanguage = normalizeLanguage(data?.language);

  return {
    defaultLanguage: fallbackLanguage,
    languages: {
      [fallbackLanguage]: normalizeSpaceDrum(data, fallbackLanguage),
    },
  };
}

export async function readJsonSpaceDrum() {
  try {
    const filePath = await resolveReadPath();
    const contents = await readFile(filePath, "utf8");
    const library = normalizeSpaceDrumLibrary(JSON.parse(contents));
    return library.languages[library.defaultLanguage] || normalizeSpaceDrum({});
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizeSpaceDrum({});
    }

    throw error;
  }
}

export async function readJsonSpaceDrumLibrary() {
  try {
    const filePath = await resolveReadPath();
    const contents = await readFile(filePath, "utf8");
    return normalizeSpaceDrumLibrary(JSON.parse(contents));
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizeSpaceDrumLibrary({});
    }

    throw error;
  }
}

export const readSpaceDrum = readJsonSpaceDrum;
