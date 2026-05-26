import {
  DEFAULT_SPACE_DRUM_LANGUAGE,
  SPACE_DRUM_LANGUAGES,
  normalizeSpaceDrum,
  normalizeSpaceDrumLibrary,
  readJsonSpaceDrum,
  readJsonSpaceDrumLibrary,
} from "../spacedrum.js";
import { getPrismaClient } from "../prisma.js";
import { safeUpsert } from "../prismaSafeUpsert.js";

const SPACE_DRUM_KEY = "main";
const SPACE_DRUM_KEY_PREFIX = "spacedrum";

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function getLanguageKey(language = DEFAULT_SPACE_DRUM_LANGUAGE) {
  return `${SPACE_DRUM_KEY_PREFIX}-${language}`;
}

const spaceDrumInclude = {
  meta: {
    orderBy: [
      { position: "asc" },
      { id: "asc" },
    ],
  },
  links: {
    orderBy: [
      { position: "asc" },
      { id: "asc" },
    ],
  },
  chapters: {
    orderBy: [
      { position: "asc" },
      { id: "asc" },
    ],
    include: {
      pages: {
        orderBy: [
          { position: "asc" },
          { id: "asc" },
        ],
      },
    },
  },
};

function compactSpaceDrumRecord(row) {
  if (!row) {
    return normalizeSpaceDrum({});
  }

  return normalizeSpaceDrum({
    title: row.title,
    language: row.key?.startsWith(`${SPACE_DRUM_KEY_PREFIX}-`)
      ? row.key.replace(`${SPACE_DRUM_KEY_PREFIX}-`, "")
      : DEFAULT_SPACE_DRUM_LANGUAGE,
    subtitle: row.subtitle,
    status: row.status,
    coverImage: row.coverImage,
    heroImage: row.heroImage,
    description: row.description,
    meta: row.meta.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    links: row.links.map((link) => ({
      label: link.label,
      url: link.url,
    })),
    chapters: row.chapters
      .filter((chapter) => (chapter.status || "published") === "published")
      .map((chapter) => ({
        id: chapter.legacyId,
        title: chapter.title,
        releaseDate: chapter.releaseDate,
        summary: chapter.summary,
        status: chapter.status || "published",
        pages: chapter.pages.map((page) => ({
          image: page.image,
          alt: page.alt,
        })),
      })),
  });
}

async function readPostgresSpaceDrum(language = DEFAULT_SPACE_DRUM_LANGUAGE) {
  const prisma = getPrismaClient();
  const row = await prisma.spaceDrum.findUnique({
    where: { key: getLanguageKey(language) },
    include: spaceDrumInclude,
  });

  if (row) {
    return compactSpaceDrumRecord(row);
  }

  if (language === DEFAULT_SPACE_DRUM_LANGUAGE) {
    const legacyRow = await prisma.spaceDrum.findUnique({
      where: { key: SPACE_DRUM_KEY },
      include: spaceDrumInclude,
    });

    return compactSpaceDrumRecord(legacyRow);
  }

  return normalizeSpaceDrum({}, language);
}

async function writePostgresSpaceDrum(data, language = DEFAULT_SPACE_DRUM_LANGUAGE) {
  const prisma = getPrismaClient();
  const normalized = normalizeSpaceDrum(data, language);
  const saved = await safeUpsert(prisma.spaceDrum, {
    where: { key: getLanguageKey(normalized.language) },
    update: {
      title: normalized.title,
      subtitle: normalized.subtitle || null,
      status: normalized.status || null,
      coverImage: normalized.coverImage || null,
      heroImage: normalized.heroImage || null,
      description: normalized.description || null,
    },
    create: {
      key: getLanguageKey(normalized.language),
      title: normalized.title,
      subtitle: normalized.subtitle || null,
      status: normalized.status || null,
      coverImage: normalized.coverImage || null,
      heroImage: normalized.heroImage || null,
      description: normalized.description || null,
    },
  });

  await Promise.all([
    prisma.spaceDrumMeta.deleteMany({ where: { spaceDrumId: saved.id } }),
    prisma.spaceDrumLink.deleteMany({ where: { spaceDrumId: saved.id } }),
    prisma.spaceDrumChapter.deleteMany({ where: { spaceDrumId: saved.id } }),
  ]);

  for (const [position, item] of normalized.meta.entries()) {
    await prisma.spaceDrumMeta.create({
      data: {
        spaceDrumId: saved.id,
        label: item.label,
        value: item.value,
        position,
      },
    });
  }

  for (const [position, link] of normalized.links.entries()) {
    await prisma.spaceDrumLink.create({
      data: {
        spaceDrumId: saved.id,
        label: link.label,
        url: link.url,
        position,
      },
    });
  }

  for (const [position, chapter] of normalized.chapters.entries()) {
    const savedChapter = await prisma.spaceDrumChapter.create({
      data: {
        spaceDrumId: saved.id,
        legacyId: chapter.id,
        title: chapter.title,
        releaseDate: chapter.releaseDate || null,
        summary: chapter.summary || null,
        status: chapter.status || "published",
        position,
      },
    });

    for (const [pagePosition, page] of chapter.pages.entries()) {
      await prisma.spaceDrumPage.create({
        data: {
          chapterId: savedChapter.id,
          image: page.image,
          alt: page.alt || null,
          position: pagePosition,
        },
      });
    }
  }

  return readPostgresSpaceDrum(normalized.language);
}

async function readPostgresSpaceDrumLibrary() {
  const languages = {};

  for (const language of SPACE_DRUM_LANGUAGES) {
    languages[language.code] = await readPostgresSpaceDrum(language.code);
  }

  return normalizeSpaceDrumLibrary({
    defaultLanguage: DEFAULT_SPACE_DRUM_LANGUAGE,
    languages,
  });
}

async function writePostgresSpaceDrumLibrary(data) {
  const library = normalizeSpaceDrumLibrary(data);
  const languages = {};

  for (const language of SPACE_DRUM_LANGUAGES) {
    languages[language.code] = await writePostgresSpaceDrum(
      library.languages[language.code],
      language.code,
    );
  }

  return normalizeSpaceDrumLibrary({
    defaultLanguage: library.defaultLanguage,
    languages,
  });
}

export async function readSpaceDrum() {
  if (!usePostgres()) {
    return readJsonSpaceDrum();
  }

  return readPostgresSpaceDrum();
}

export async function readSpaceDrumLibrary() {
  if (!usePostgres()) {
    return readJsonSpaceDrumLibrary();
  }

  return readPostgresSpaceDrumLibrary();
}

export async function writeSpaceDrum(data) {
  if (!usePostgres()) {
    return data?.languages ? normalizeSpaceDrumLibrary(data) : normalizeSpaceDrum(data);
  }

  return data?.languages ? writePostgresSpaceDrumLibrary(data) : writePostgresSpaceDrum(data);
}

function compactAdminChapter(chapter) {
  const languageKey = chapter.spaceDrum?.key || "";
  const language = languageKey.startsWith(`${SPACE_DRUM_KEY_PREFIX}-`)
    ? languageKey.replace(`${SPACE_DRUM_KEY_PREFIX}-`, "")
    : DEFAULT_SPACE_DRUM_LANGUAGE;

  return {
    id: chapter.id,
    spaceDrumId: chapter.spaceDrumId,
    language,
    legacyId: chapter.legacyId,
    title: chapter.title,
    releaseDate: chapter.releaseDate || "",
    summary: chapter.summary || "",
    status: chapter.status || "published",
    position: chapter.position || 0,
    pagesCount: chapter._count?.pages ?? chapter.pages?.length ?? 0,
    thumbnail: chapter.pages?.[0]?.image || chapter.pages?.[1]?.image || "",
    updatedAt: chapter.spaceDrum?.updatedAt?.toISOString?.() || null,
  };
}

function getLanguageFromSpaceDrumKey(key = "") {
  return key.startsWith(`${SPACE_DRUM_KEY_PREFIX}-`)
    ? key.replace(`${SPACE_DRUM_KEY_PREFIX}-`, "")
    : DEFAULT_SPACE_DRUM_LANGUAGE;
}

function compactAdminPage(page) {
  const language = getLanguageFromSpaceDrumKey(page.chapter?.spaceDrum?.key || "");

  return {
    id: page.id,
    chapterId: page.chapterId,
    image: page.image,
    alt: page.alt || "",
    position: page.position || 0,
    language,
    chapterTitle: page.chapter?.title || "Sin capítulo",
    chapterLegacyId: page.chapter?.legacyId || "",
    chapterStatus: page.chapter?.status || "published",
  };
}

function compactAdminSettings(row, language = DEFAULT_SPACE_DRUM_LANGUAGE) {
  const normalized = normalizeSpaceDrum(row ? {
    language,
    title: row.title,
    subtitle: row.subtitle,
    status: row.status,
    coverImage: row.coverImage,
    heroImage: row.heroImage,
    description: row.description,
    meta: row.meta?.map((item) => ({ label: item.label, value: item.value })) || [],
    links: row.links?.map((link) => ({ label: link.label, url: link.url })) || [],
    chapters: [],
  } : {}, language);

  return {
    language: normalized.language,
    title: normalized.title,
    subtitle: normalized.subtitle,
    status: normalized.status,
    coverImage: normalized.coverImage,
    heroImage: normalized.heroImage,
    description: normalized.description,
    meta: normalized.meta,
    links: normalized.links,
    chaptersCount: row?._count?.chapters || 0,
    updatedAt: row?.updatedAt?.toISOString?.() || null,
  };
}

function normalizeChapterStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["draft", "published", "hidden"].includes(value)) {
    return value;
  }
  return "draft";
}

function normalizeAdminChapterPayload(payload = {}) {
  const language = String(payload.language || DEFAULT_SPACE_DRUM_LANGUAGE).trim() || DEFAULT_SPACE_DRUM_LANGUAGE;
  const title = String(payload.title || "").trim();
  const legacyId = String(payload.legacyId || title)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const releaseDate = String(payload.releaseDate || "").trim();
  const summary = String(payload.summary || "").trim();
  const position = Number.isFinite(Number(payload.position)) ? Number(payload.position) : 0;
  const status = normalizeChapterStatus(payload.status);

  if (!SPACE_DRUM_LANGUAGES.some((item) => item.code === language)) {
    throw new Error("El idioma no es válido.");
  }

  if (!title) {
    throw new Error("El título es obligatorio.");
  }

  if (!legacyId) {
    throw new Error("El código interno es obligatorio.");
  }

  if (title.length > 120) {
    throw new Error("El título no puede superar 120 caracteres.");
  }

  if (legacyId.length > 120) {
    throw new Error("El código interno no puede superar 120 caracteres.");
  }

  return { language, title, legacyId, releaseDate, summary, position, status };
}

export async function listSpaceDrumAdminChapters() {
  if (!usePostgres()) {
    const library = await readJsonSpaceDrumLibrary();
    return Object.values(library.languages || {}).flatMap((languageData) =>
      (languageData.chapters || []).map((chapter, position) => ({
        id: chapter.id,
        spaceDrumId: null,
        language: languageData.language || DEFAULT_SPACE_DRUM_LANGUAGE,
        legacyId: chapter.id,
        title: chapter.title,
        releaseDate: chapter.releaseDate || "",
        summary: chapter.summary || "",
        status: chapter.status || "published",
        position,
        pagesCount: chapter.pages?.length || 0,
        thumbnail: chapter.pages?.[0]?.image || chapter.pages?.[1]?.image || "",
      })),
    );
  }

  const prisma = getPrismaClient();
  const chapters = await prisma.spaceDrumChapter.findMany({
    orderBy: [
      { spaceDrumId: "asc" },
      { position: "asc" },
      { id: "asc" },
    ],
    include: {
      spaceDrum: true,
      pages: {
        orderBy: [
          { position: "asc" },
          { id: "asc" },
        ],
        take: 2,
      },
      _count: { select: { pages: true } },
    },
  });

  return chapters.map(compactAdminChapter);
}

export async function getSpaceDrumAdminChapter(chapterId) {
  if (!usePostgres()) {
    return null;
  }

  const prisma = getPrismaClient();
  const chapter = await prisma.spaceDrumChapter.findUnique({
    where: { id: Number(chapterId) },
    include: {
      spaceDrum: true,
      pages: {
        orderBy: [
          { position: "asc" },
          { id: "asc" },
        ],
      },
      _count: { select: { pages: true } },
    },
  });

  return chapter ? compactAdminChapter(chapter) : null;
}

async function ensureSpaceDrumLanguageRecord(language) {
  const prisma = getPrismaClient();
  const languageInfo = SPACE_DRUM_LANGUAGES.find((item) => item.code === language);

  return safeUpsert(prisma.spaceDrum, {
    where: { key: getLanguageKey(language) },
    update: {},
    create: {
      key: getLanguageKey(language),
      title: "SpaceDrum",
      subtitle: languageInfo?.label === "English" ? "Official SpaceDrum manga" : "Manga oficial de SpaceDrum",
      status: languageInfo?.label || language,
    },
  });
}

export async function upsertSpaceDrumAdminChapter(payload = {}) {
  if (!usePostgres()) {
    throw new Error("El mantenedor de SpaceDrum requiere PostgreSQL.");
  }

  const prisma = getPrismaClient();
  const normalized = normalizeAdminChapterPayload(payload);
  const spaceDrum = await ensureSpaceDrumLanguageRecord(normalized.language);
  const id = Number(payload.id || 0);

  const chapter = id
    ? await prisma.spaceDrumChapter.update({
      where: { id },
      data: {
        spaceDrumId: spaceDrum.id,
        legacyId: normalized.legacyId,
        title: normalized.title,
        releaseDate: normalized.releaseDate || null,
        summary: normalized.summary || null,
        position: normalized.position,
        status: normalized.status,
      },
      include: {
        spaceDrum: true,
        pages: { orderBy: [{ position: "asc" }, { id: "asc" }], take: 2 },
        _count: { select: { pages: true } },
      },
    })
    : await prisma.spaceDrumChapter.create({
      data: {
        spaceDrumId: spaceDrum.id,
        legacyId: normalized.legacyId,
        title: normalized.title,
        releaseDate: normalized.releaseDate || null,
        summary: normalized.summary || null,
        position: normalized.position,
        status: normalized.status,
      },
      include: {
        spaceDrum: true,
        pages: { orderBy: [{ position: "asc" }, { id: "asc" }], take: 2 },
        _count: { select: { pages: true } },
      },
    });

  return compactAdminChapter(chapter);
}

export async function updateSpaceDrumAdminChapterStatus(chapterId, status) {
  if (!usePostgres()) {
    throw new Error("El mantenedor de SpaceDrum requiere PostgreSQL.");
  }

  const prisma = getPrismaClient();
  const chapter = await prisma.spaceDrumChapter.update({
    where: { id: Number(chapterId) },
    data: { status: normalizeChapterStatus(status) },
    include: {
      spaceDrum: true,
      pages: { orderBy: [{ position: "asc" }, { id: "asc" }], take: 2 },
      _count: { select: { pages: true } },
    },
  });

  return compactAdminChapter(chapter);
}

export async function deleteSpaceDrumAdminChapter(chapterId) {
  if (!usePostgres()) {
    throw new Error("El mantenedor de SpaceDrum requiere PostgreSQL.");
  }

  const prisma = getPrismaClient();
  const before = await getSpaceDrumAdminChapter(chapterId);
  await prisma.spaceDrumChapter.delete({ where: { id: Number(chapterId) } });
  return before;
}

export async function listSpaceDrumAdminPages({ chapterId } = {}) {
  if (!usePostgres()) {
    return [];
  }

  const prisma = getPrismaClient();
  const pages = await prisma.spaceDrumPage.findMany({
    where: chapterId ? { chapterId: Number(chapterId) } : undefined,
    orderBy: [
      { chapterId: "asc" },
      { position: "asc" },
      { id: "asc" },
    ],
    include: {
      chapter: {
        include: {
          spaceDrum: true,
        },
      },
    },
  });

  return pages.map(compactAdminPage);
}

export async function getSpaceDrumAdminPage(pageId) {
  if (!usePostgres()) {
    return null;
  }

  const prisma = getPrismaClient();
  const page = await prisma.spaceDrumPage.findUnique({
    where: { id: Number(pageId) },
    include: {
      chapter: {
        include: {
          spaceDrum: true,
        },
      },
    },
  });

  return page ? compactAdminPage(page) : null;
}

function normalizeAdminPagePayload(payload = {}) {
  const chapterId = Number(payload.chapterId || 0);
  const image = String(payload.image || "").trim();
  const alt = String(payload.alt || "").trim();
  const position = Number.isFinite(Number(payload.position)) ? Number(payload.position) : 0;

  if (!chapterId) {
    throw new Error("El capítulo es obligatorio.");
  }

  if (!image) {
    throw new Error("La URL de imagen es obligatoria.");
  }

  if (image.length > 500) {
    throw new Error("La URL de imagen no puede superar 500 caracteres.");
  }

  if (alt.length > 160) {
    throw new Error("El texto alternativo no puede superar 160 caracteres.");
  }

  return { chapterId, image, alt, position };
}

export async function upsertSpaceDrumAdminPage(payload = {}) {
  if (!usePostgres()) {
    throw new Error("El mantenedor de páginas requiere PostgreSQL.");
  }

  const prisma = getPrismaClient();
  const normalized = normalizeAdminPagePayload(payload);
  const id = Number(payload.id || 0);

  const chapter = await prisma.spaceDrumChapter.findUnique({ where: { id: normalized.chapterId } });
  if (!chapter) {
    throw new Error("El capítulo seleccionado no existe.");
  }

  const page = id
    ? await prisma.spaceDrumPage.update({
      where: { id },
      data: {
        chapterId: normalized.chapterId,
        image: normalized.image,
        alt: normalized.alt || null,
        position: normalized.position,
      },
      include: { chapter: { include: { spaceDrum: true } } },
    })
    : await prisma.spaceDrumPage.create({
      data: {
        chapterId: normalized.chapterId,
        image: normalized.image,
        alt: normalized.alt || null,
        position: normalized.position,
      },
      include: { chapter: { include: { spaceDrum: true } } },
    });

  return compactAdminPage(page);
}

export async function deleteSpaceDrumAdminPage(pageId) {
  if (!usePostgres()) {
    throw new Error("El mantenedor de páginas requiere PostgreSQL.");
  }

  const prisma = getPrismaClient();
  const before = await getSpaceDrumAdminPage(pageId);
  await prisma.spaceDrumPage.delete({ where: { id: Number(pageId) } });
  return before;
}

export async function listSpaceDrumAdminSettings() {
  if (!usePostgres()) {
    const library = await readJsonSpaceDrumLibrary();
    return SPACE_DRUM_LANGUAGES.map((language) => compactAdminSettings(
      library.languages?.[language.code],
      language.code,
    ));
  }

  const prisma = getPrismaClient();
  const rows = await prisma.spaceDrum.findMany({
    where: {
      key: { in: SPACE_DRUM_LANGUAGES.map((language) => getLanguageKey(language.code)) },
    },
    include: {
      meta: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      links: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      _count: { select: { chapters: true } },
    },
  });
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));

  return SPACE_DRUM_LANGUAGES.map((language) => compactAdminSettings(
    rowsByKey.get(getLanguageKey(language.code)),
    language.code,
  ));
}

export async function getSpaceDrumAdminSettings(language = DEFAULT_SPACE_DRUM_LANGUAGE) {
  const settings = await listSpaceDrumAdminSettings();
  return settings.find((item) => item.language === language) || settings[0] || null;
}

function normalizeAdminSettingsPayload(payload = {}) {
  const language = String(payload.language || DEFAULT_SPACE_DRUM_LANGUAGE).trim();
  const title = String(payload.title || "").trim();
  const subtitle = String(payload.subtitle || "").trim();
  const status = String(payload.status || "").trim();
  const coverImage = String(payload.coverImage || "").trim();
  const heroImage = String(payload.heroImage || "").trim();
  const description = String(payload.description || "").trim();
  const meta = Array.isArray(payload.meta)
    ? payload.meta
      .map((item) => ({
        label: String(item?.label || "").trim(),
        value: String(item?.value || "").trim(),
      }))
      .filter((item) => item.label && item.value)
    : [];
  const links = Array.isArray(payload.links)
    ? payload.links
      .map((item) => ({
        label: String(item?.label || "").trim(),
        url: String(item?.url || "").trim(),
      }))
      .filter((item) => item.label && item.url)
    : [];

  if (!SPACE_DRUM_LANGUAGES.some((item) => item.code === language)) {
    throw new Error("El idioma no es válido.");
  }

  if (!title) {
    throw new Error("El título es obligatorio.");
  }

  if (title.length > 80) {
    throw new Error("El título no puede superar 80 caracteres.");
  }

  if (subtitle.length > 120) {
    throw new Error("El subtítulo no puede superar 120 caracteres.");
  }

  if (status.length > 80) {
    throw new Error("El estado no puede superar 80 caracteres.");
  }

  return { language, title, subtitle, status, coverImage, heroImage, description, meta, links };
}

export async function updateSpaceDrumAdminSettings(payload = {}) {
  if (!usePostgres()) {
    throw new Error("La configuración de SpaceDrum requiere PostgreSQL.");
  }

  const prisma = getPrismaClient();
  const normalized = normalizeAdminSettingsPayload(payload);
  const spaceDrum = await safeUpsert(prisma.spaceDrum, {
    where: { key: getLanguageKey(normalized.language) },
    update: {
      title: normalized.title,
      subtitle: normalized.subtitle || null,
      status: normalized.status || null,
      coverImage: normalized.coverImage || null,
      heroImage: normalized.heroImage || null,
      description: normalized.description || null,
    },
    create: {
      key: getLanguageKey(normalized.language),
      title: normalized.title,
      subtitle: normalized.subtitle || null,
      status: normalized.status || null,
      coverImage: normalized.coverImage || null,
      heroImage: normalized.heroImage || null,
      description: normalized.description || null,
    },
  });

  await Promise.all([
    prisma.spaceDrumMeta.deleteMany({ where: { spaceDrumId: spaceDrum.id } }),
    prisma.spaceDrumLink.deleteMany({ where: { spaceDrumId: spaceDrum.id } }),
  ]);

  for (const [position, item] of normalized.meta.entries()) {
    await prisma.spaceDrumMeta.create({
      data: {
        spaceDrumId: spaceDrum.id,
        label: item.label,
        value: item.value,
        position,
      },
    });
  }

  for (const [position, link] of normalized.links.entries()) {
    await prisma.spaceDrumLink.create({
      data: {
        spaceDrumId: spaceDrum.id,
        label: link.label,
        url: link.url,
        position,
      },
    });
  }

  return getSpaceDrumAdminSettings(normalized.language);
}

function compactProgress(row) {
  if (!row) {
    return null;
  }

  return {
    language: row.language,
    lastChapterId: row.lastChapterId || "",
    readChapterIds: Array.isArray(row.readChapterIds) ? row.readChapterIds : [],
    updatedAt: row.updatedAt?.toISOString?.() || null,
  };
}

export async function getSpaceDrumProgressForUser(userId) {
  if (!userId || !usePostgres()) {
    return {};
  }

  const prisma = getPrismaClient();
  const rows = await prisma.platformUserSpaceDrumProgress.findMany({
    where: { userId },
    orderBy: { language: "asc" },
  });

  return rows.reduce((acc, row) => {
    acc[row.language] = compactProgress(row);
    return acc;
  }, {});
}

export async function updateSpaceDrumProgressForUser(userId, payload = {}) {
  if (!userId) {
    throw new Error("Usuario requerido.");
  }

  if (!usePostgres()) {
    const language = payload.language || DEFAULT_SPACE_DRUM_LANGUAGE;
    return {
      language,
      lastChapterId: payload.chapterId || "",
      readChapterIds: payload.chapterId ? [payload.chapterId] : [],
      updatedAt: new Date().toISOString(),
    };
  }

  const language = SPACE_DRUM_LANGUAGES.some((item) => item.code === payload.language)
    ? payload.language
    : DEFAULT_SPACE_DRUM_LANGUAGE;
  const chapterId = String(payload.chapterId || "").trim();
  const shouldMarkRead = payload.markRead !== false;
  const prisma = getPrismaClient();
  const current = await prisma.platformUserSpaceDrumProgress.findUnique({
    where: {
      userId_language: {
        userId,
        language,
      },
    },
  });
  const currentReadIds = Array.isArray(current?.readChapterIds) ? current.readChapterIds : [];
  const readChapterIds = shouldMarkRead && chapterId
    ? Array.from(new Set([...currentReadIds, chapterId]))
    : currentReadIds;

  const row = await prisma.platformUserSpaceDrumProgress.upsert({
    where: {
      userId_language: {
        userId,
        language,
      },
    },
    update: {
      lastChapterId: chapterId || current?.lastChapterId || null,
      readChapterIds,
    },
    create: {
      userId,
      language,
      lastChapterId: chapterId || null,
      readChapterIds,
    },
  });

  return compactProgress(row);
}
