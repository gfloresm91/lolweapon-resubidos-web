import { getPrismaClient } from "../prisma.js";
import { fetchAniListMediaById } from "../animeTierListSources.js";

function usePostgres() {
  return String(process.env.DATA_SOURCE || "").toLowerCase() === "postgres";
}

function compactEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    seasonId: entry.seasonId,
    aniListId: entry.aniListId,
    isManual: entry.isManual,
    title: entry.manualTitle || entry.titleRomaji,
    titleRomaji: entry.titleRomaji,
    titleEnglish: entry.titleEnglish,
    titleNative: entry.titleNative,
    imageUrl: entry.manualImageUrl || entry.imageUrl,
    format: entry.format,
    episodes: entry.episodes,
    status: entry.status,
    aniListUrl: entry.aniListUrl,
    isAdult: entry.manualIsAdult ?? entry.isAdult,
    isDonghua: entry.manualIsDonghua ?? entry.isDonghua,
    manualTitle: entry.manualTitle,
    manualImageUrl: entry.manualImageUrl,
    manualIsAdult: entry.manualIsAdult,
    manualIsDonghua: entry.manualIsDonghua,
    manualVisible: entry.manualVisible,
    isHiddenByAdmin: entry.manualVisible === false,
    duplicateGroupId: entry.duplicateGroupId,
    isDeleted: Boolean(entry.deletedAt),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function listAnimeTierListEntriesForAdmin({ seasonId }) {
  if (!usePostgres()) return [];
  const prisma = getPrismaClient();
  const rows = await prisma.animeTierListEntry.findMany({
    where: { seasonId: Number(seasonId) },
    orderBy: [{ titleRomaji: "asc" }],
  });
  return rows.map(compactEntry);
}

export async function createAnimeTierListEntry({ seasonId, aniListId }) {
  const prisma = getPrismaClient();
  const normalizedSeasonId = Number(seasonId);
  const normalizedAniListId = Number(aniListId);
  if (!Number.isInteger(normalizedSeasonId) || normalizedSeasonId <= 0) {
    throw new Error("Selecciona una temporada válida.");
  }
  if (!Number.isInteger(normalizedAniListId) || normalizedAniListId <= 0) {
    throw new Error("El ID de AniList no es válido.");
  }

  const media = await fetchAniListMediaById(normalizedAniListId);
  if (!media) {
    throw new Error("No se encontró ese anime en AniList.");
  }

  const data = {
    isManual: true,
    deletedAt: null,
    titleRomaji: media.titleRomaji,
    titleEnglish: media.titleEnglish,
    titleNative: media.titleNative,
    imageUrl: media.imageUrl,
    format: media.format,
    episodes: media.episodes,
    status: media.status,
    aniListUrl: media.aniListUrl,
    isAdult: media.isAdult,
    isDonghua: media.isDonghua,
    sourceUpdatedAt: media.sourceUpdatedAt,
  };

  const row = await prisma.animeTierListEntry.upsert({
    where: { seasonId_aniListId: { seasonId: normalizedSeasonId, aniListId: normalizedAniListId } },
    update: data,
    create: { seasonId: normalizedSeasonId, aniListId: normalizedAniListId, ...data },
  });
  return compactEntry(row);
}

export async function createManualAnimeTierListEntry({ seasonId, title, imageUrl, isAdult, isDonghua }) {
  const prisma = getPrismaClient();
  const normalizedSeasonId = Number(seasonId);
  if (!Number.isInteger(normalizedSeasonId) || normalizedSeasonId <= 0) {
    throw new Error("Selecciona una temporada válida.");
  }
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) {
    throw new Error("El título del anime es obligatorio.");
  }

  const row = await prisma.animeTierListEntry.create({
    data: {
      seasonId: normalizedSeasonId,
      aniListId: null,
      isManual: true,
      titleRomaji: normalizedTitle,
      imageUrl: imageUrl || null,
      isAdult: Boolean(isAdult),
      isDonghua: Boolean(isDonghua),
    },
  });
  return compactEntry(row);
}

export async function duplicateAnimeTierListEntryAsManual({ sourceEntryId, seasonId, title, imageUrl, isAdult, isDonghua }) {
  const prisma = getPrismaClient();
  const source = await prisma.animeTierListEntry.findUnique({ where: { id: Number(sourceEntryId) } });
  if (!source) {
    throw new Error("No se encontró el anime a duplicar.");
  }
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) {
    throw new Error("El título del anime es obligatorio.");
  }

  // Todas las copias comparten el mismo grupo que la entrada original, para poder contar
  // cuántas siguen activas (las eliminadas ya no aparecen en las consultas de "sin tema").
  const groupId = source.duplicateGroupId || source.id;
  if (!source.duplicateGroupId) {
    await prisma.animeTierListEntry.update({ where: { id: source.id }, data: { duplicateGroupId: groupId } });
  }

  const row = await prisma.animeTierListEntry.create({
    data: {
      seasonId: Number(seasonId),
      aniListId: null,
      isManual: true,
      titleRomaji: normalizedTitle,
      imageUrl: imageUrl || null,
      isAdult: Boolean(isAdult),
      isDonghua: Boolean(isDonghua),
      duplicateGroupId: groupId,
    },
  });
  return compactEntry(row);
}

export async function relinkAnimeTierListEntry({ id, aniListId }) {
  const prisma = getPrismaClient();
  const entryId = Number(id);
  const normalizedAniListId = Number(aniListId);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error("Entrada inválida.");
  }
  if (!Number.isInteger(normalizedAniListId) || normalizedAniListId <= 0) {
    throw new Error("El ID de AniList no es válido.");
  }

  const current = await prisma.animeTierListEntry.findUnique({ where: { id: entryId } });
  if (!current) {
    throw new Error("No se encontró la entrada.");
  }

  if (normalizedAniListId !== current.aniListId) {
    const collision = await prisma.animeTierListEntry.findUnique({
      where: { seasonId_aniListId: { seasonId: current.seasonId, aniListId: normalizedAniListId } },
    });
    if (collision) {
      throw new Error("Ese anime ya existe en esta temporada.");
    }
  }

  const media = await fetchAniListMediaById(normalizedAniListId);
  if (!media) {
    throw new Error("No se encontró ese anime en AniList.");
  }

  const row = await prisma.animeTierListEntry.update({
    where: { id: entryId },
    data: {
      aniListId: normalizedAniListId,
      isManual: true,
      manualTitle: null,
      manualImageUrl: null,
      manualIsAdult: null,
      manualIsDonghua: null,
      titleRomaji: media.titleRomaji,
      titleEnglish: media.titleEnglish,
      titleNative: media.titleNative,
      imageUrl: media.imageUrl,
      format: media.format,
      episodes: media.episodes,
      status: media.status,
      aniListUrl: media.aniListUrl,
      isAdult: media.isAdult,
      isDonghua: media.isDonghua,
      sourceUpdatedAt: media.sourceUpdatedAt,
    },
  });
  return compactEntry(row);
}

export async function updateAnimeTierListEntry(input) {
  const prisma = getPrismaClient();
  const row = await prisma.animeTierListEntry.update({
    where: { id: Number(input.id) },
    data: {
      manualTitle: input.manualTitle === "" ? null : input.manualTitle,
      manualVisible: typeof input.manualVisible === "boolean" ? input.manualVisible : null,
    },
  });
  return compactEntry(row);
}

export async function deleteAnimeTierListEntry(id) {
  const prisma = getPrismaClient();
  const row = await prisma.animeTierListEntry.update({
    where: { id: Number(id) },
    data: { deletedAt: new Date() },
  });
  return compactEntry(row);
}

export async function restoreAnimeTierListEntry(id) {
  const prisma = getPrismaClient();
  const row = await prisma.animeTierListEntry.update({
    where: { id: Number(id) },
    data: { deletedAt: null },
  });
  return compactEntry(row);
}
