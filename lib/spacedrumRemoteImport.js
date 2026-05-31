import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SPACE_DRUM_LANGUAGES, normalizeSpaceDrumLibrary } from "./spacedrum.js";
import { writeSpaceDrum } from "./repositories/spaceDrumRepository.js";

const API_BASE_URL = "https://www.mangaspacedrum.com";
const ASSET_BASE_URL = "https://spacedrum-worker.lolweapons.workers.dev/assets";
const FETCH_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;
const dataDir = path.join(process.cwd(), "data");
const localDataFile = path.join(dataDir, "spacedrum.local.json");

const LANGUAGE_COPY = {
  "es-es": {
    subtitle: "Manga oficial de SpaceDrum",
    status: "Lectura disponible",
    description:
      "RENACIMIENTO, VIDA, MUERTE, DESINTEGRACIÓN ASTRAL.\nRENACIMIENTO, VIDA, MUERTE, DESINTEGRACIÓN ASTRAL.\nRENACIMIENTO, VIDA, MUERTE, DESINTEGRACIÓN ASTRAL.\n\nTodos los seres del firmamento viven encerrados en este ciclo infinito.\nO así era hasta el día en el que ellas bajaron desde los cielos.\nLa humanidad dejó de ser humana.\nLa muerte dejó de ser el final.\n\nLa iluminación llegó para salvar a sus hijos y derrotar al sentimiento más poderoso que la conciencia había podido crear.",
    chapterPrefix: "Ciclo",
    originalLabel: "Sitio original",
    scriptYoutubeLabel: "Guion: YouTube",
    scriptInstagramLabel: "Guion: Instagram",
    scriptTwitchLabel: "Guion: Twitch",
    artXLabel: "Arte: X",
    artInstagramLabel: "Arte: Instagram",
    buscalibreLabel: "Comprar en Buscalibre",
    volumeLabel: "Comprar tomo",
  },
  "en-us": {
    subtitle: "Official SpaceDrum manga",
    status: "Available to read",
    description:
      "REBIRTH, LIFE, DEATH, ASTRAL DISINTEGRATION.\nREBIRTH, LIFE, DEATH, ASTRAL DISINTEGRATION.\nREBIRTH, LIFE, DEATH, ASTRAL DISINTEGRATION.\n\nAll beings in the firmament live trapped inside this infinite cycle.\nOr so it was until the day they descended from the heavens.\nHumanity stopped being human.\nDeath stopped being the end.\n\nEnlightenment arrived to save its children and defeat the most powerful feeling consciousness had ever created.",
    chapterPrefix: "Cycle",
    originalLabel: "Original site",
    scriptYoutubeLabel: "Script: YouTube",
    scriptInstagramLabel: "Script: Instagram",
    scriptTwitchLabel: "Script: Twitch",
    artXLabel: "Art: X",
    artInstagramLabel: "Art: Instagram",
    buscalibreLabel: "Buy on Buscalibre",
    volumeLabel: "Buy volume",
  },
};

async function fetchJson(url, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`No se pudo descargar ${url}: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    if (attempt < MAX_ATTEMPTS) {
      return fetchJson(url, attempt + 1);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRemoteChapter(chapter, language, index) {
  const copy = LANGUAGE_COPY[language] || LANGUAGE_COPY["es-es"];
  const pages = Array.isArray(chapter?.content) ? chapter.content : [];

  return {
    id: String(chapter?._id || `${language}-${index + 1}`),
    title: String(chapter?.name || `${copy.chapterPrefix} ${index + 1}`).trim(),
    releaseDate: String(chapter?.createdAt || ""),
    summary: "",
    language,
    pages: pages.map((image, pageIndex) => ({
      image,
      alt: `${chapter?.name || copy.chapterPrefix} - Página ${pageIndex + 1}`,
    })),
  };
}

export async function buildRemoteSpaceDrumLanguageData(language) {
  const url = `${API_BASE_URL}/chapters?lan=${language}`;
  const payload = await fetchJson(url);
  const chapters = Array.isArray(payload?.body) ? payload.body : [];
  const copy = LANGUAGE_COPY[language] || LANGUAGE_COPY["es-es"];

  if (!chapters.length) {
    throw new Error(`La API de SpaceDrum no devolvió capítulos para ${language}.`);
  }

  return {
    language,
    title: "SpaceDrum",
    subtitle: copy.subtitle,
    status: copy.status,
    coverImage: `${ASSET_BASE_URL}/spacedrum_logo.png`,
    heroImage: `${ASSET_BASE_URL}/background.jpg`,
    description: copy.description,
    meta: [
      { label: "Capítulos", value: String(chapters.length) },
      {
        label: "Páginas",
        value: String(chapters.reduce((sum, chapter) => sum + (chapter.content?.length || 0), 0)),
      },
      { label: "Idioma", value: language === "es-es" ? "Español" : "English" },
    ],
    links: [
      { label: copy.originalLabel, url: "https://mangaspacedrum.com/#/" },
      { label: copy.scriptYoutubeLabel, url: "https://www.youtube.com/@Lolweapon" },
      { label: copy.scriptInstagramLabel, url: "https://www.instagram.com/kalathras_lolweapon/" },
      { label: copy.scriptTwitchLabel, url: "https://www.twitch.tv/kalathraslolweapon" },
      { label: copy.artXLabel, url: "https://twitter.com/ArtSoritha" },
      { label: copy.artInstagramLabel, url: "https://www.instagram.com/soritha_art/" },
      { label: copy.buscalibreLabel, url: "https://www.buscalibre.cl/libros/search?q=spacedrum" },
      { label: copy.volumeLabel, url: "https://amzn.to/3J2Gdfh" },
    ],
    chapters: chapters
      .slice()
      .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
      .map((chapter, index) => normalizeRemoteChapter(chapter, language, index)),
  };
}

export async function buildRemoteSpaceDrumLibrary() {
  const languages = {};

  for (const language of SPACE_DRUM_LANGUAGES) {
    languages[language.code] = await buildRemoteSpaceDrumLanguageData(language.code);
  }

  return normalizeSpaceDrumLibrary({
    defaultLanguage: "es-es",
    languages,
  });
}

export function getSpaceDrumImportSummary(library) {
  const languages = Object.values(library?.languages || {});
  const chapters = languages.reduce((sum, language) => sum + (language.chapters?.length || 0), 0);
  const pages = languages.reduce(
    (sum, language) => sum + (language.chapters || []).reduce((pageSum, chapter) => pageSum + (chapter.pages?.length || 0), 0),
    0,
  );

  return {
    languages: languages.length,
    chapters,
    pages,
    byLanguage: languages.map((language) => ({
      language: language.language,
      chapters: language.chapters?.length || 0,
      pages: (language.chapters || []).reduce((sum, chapter) => sum + (chapter.pages?.length || 0), 0),
    })),
  };
}

export async function importRemoteSpaceDrum({ writeJson = false } = {}) {
  const library = await buildRemoteSpaceDrumLibrary();
  const saved = await writeSpaceDrum(library);

  if (writeJson) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(localDataFile, `${JSON.stringify(library, null, 2)}\n`, "utf8");
  }

  return {
    library: saved,
    summary: getSpaceDrumImportSummary(saved),
    localDataFile: writeJson ? path.relative(process.cwd(), localDataFile) : null,
  };
}
