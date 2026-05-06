import { normalizeSpaceDrum, readJsonSpaceDrum } from "../spacedrum.js";
import { getPrismaClient } from "../prisma.js";

const SPACE_DRUM_KEY = "main";

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
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
    chapters: row.chapters.map((chapter) => ({
      id: chapter.legacyId,
      title: chapter.title,
      releaseDate: chapter.releaseDate,
      summary: chapter.summary,
      pages: chapter.pages.map((page) => ({
        image: page.image,
        alt: page.alt,
      })),
    })),
  });
}

async function readPostgresSpaceDrum() {
  const prisma = getPrismaClient();
  const row = await prisma.spaceDrum.findUnique({
    where: { key: SPACE_DRUM_KEY },
    include: spaceDrumInclude,
  });

  return compactSpaceDrumRecord(row);
}

async function writePostgresSpaceDrum(data) {
  const prisma = getPrismaClient();
  const normalized = normalizeSpaceDrum(data);
  const saved = await prisma.spaceDrum.upsert({
    where: { key: SPACE_DRUM_KEY },
    update: {
      title: normalized.title,
      subtitle: normalized.subtitle || null,
      status: normalized.status || null,
      coverImage: normalized.coverImage || null,
      heroImage: normalized.heroImage || null,
      description: normalized.description || null,
    },
    create: {
      key: SPACE_DRUM_KEY,
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

  return readPostgresSpaceDrum();
}

export async function readSpaceDrum() {
  if (!usePostgres()) {
    return readJsonSpaceDrum();
  }

  return readPostgresSpaceDrum();
}

export async function writeSpaceDrum(data) {
  if (!usePostgres()) {
    return normalizeSpaceDrum(data);
  }

  return writePostgresSpaceDrum(data);
}
