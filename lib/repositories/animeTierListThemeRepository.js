import { getPrismaClient } from "../prisma.js";
import { createAnimeTierListEntry, createManualAnimeTierListEntry } from "./animeTierListEntryRepository.js";

function usePostgres() {
  return String(process.env.DATA_SOURCE || "").toLowerCase() === "postgres";
}

function compactTheme(theme) {
  if (!theme) return null;
  return {
    id: theme.id,
    tierListEntryId: theme.tierListEntryId,
    animeThemeId: theme.animeThemeId,
    isManual: theme.isManual,
    type: theme.manualType || theme.type,
    sequence: theme.manualSequence ?? theme.sequence,
    songTitle: theme.manualSongTitle || theme.songTitle,
    artist: theme.manualArtist || theme.artist,
    videoUrl: theme.manualVideoUrl || theme.videoUrl,
    videoResolution: theme.videoResolution,
    videoSource: theme.videoSource,
    isSpoiler: theme.isSpoiler,
    manualType: theme.manualType,
    manualSequence: theme.manualSequence,
    manualVideoUrl: theme.manualVideoUrl,
    manualSongTitle: theme.manualSongTitle,
    manualArtist: theme.manualArtist,
    manualVisible: theme.manualVisible,
    alternateVideoUrl: theme.alternateVideoUrl,
    isHiddenByAdmin: theme.manualVisible === false,
    isDeleted: Boolean(theme.deletedAt),
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt,
  };
}

export async function listAnimeTierListThemesForAdmin({ seasonId }) {
  if (!usePostgres()) return [];
  const prisma = getPrismaClient();
  const rows = await prisma.animeTierListTheme.findMany({
    where: { entry: { seasonId: Number(seasonId) } },
    include: { entry: { select: { titleRomaji: true, manualTitle: true, imageUrl: true, manualImageUrl: true, aniListId: true, isAdult: true, isDonghua: true, manualIsAdult: true, manualIsDonghua: true } } },
    orderBy: [{ type: "asc" }, { sequence: "asc" }],
  });
  return rows.map((row) => ({
    ...compactTheme(row),
    animeTitle: row.entry?.manualTitle || row.entry?.titleRomaji || null,
    animeImageUrl: row.entry?.manualImageUrl || row.entry?.imageUrl || null,
    animeAniListId: row.entry?.aniListId ?? null,
    animeIsAdult: row.entry?.manualIsAdult ?? row.entry?.isAdult ?? false,
    animeIsDonghua: row.entry?.manualIsDonghua ?? row.entry?.isDonghua ?? false,
    animeManualIsAdult: row.entry?.manualIsAdult ?? null,
    animeManualIsDonghua: row.entry?.manualIsDonghua ?? null,
  }));
}

function validateThemeInput({ type, sequence, videoUrl }) {
  const normalizedType = String(type || "").toUpperCase();
  if (!["OP", "ED"].includes(normalizedType)) {
    throw new Error("El tipo debe ser OP o ED.");
  }
  const normalizedSequence = Number(sequence);
  if (!Number.isInteger(normalizedSequence) || normalizedSequence < 1) {
    throw new Error("El número de secuencia no es válido.");
  }
  if (!String(videoUrl || "").trim()) {
    throw new Error("La fuente principal es obligatoria.");
  }
  return { type: normalizedType, sequence: normalizedSequence, videoUrl: String(videoUrl).trim() };
}

export async function createAnimeTierListTheme(input) {
  const prisma = getPrismaClient();
  const seasonId = Number(input.seasonId);
  if (!Number.isInteger(seasonId) || seasonId <= 0) {
    throw new Error("Selecciona una temporada válida.");
  }
  const { type, sequence, videoUrl } = validateThemeInput(input);

  let entry;
  if (input.aniListId) {
    const aniListId = Number(input.aniListId);
    if (!Number.isInteger(aniListId) || aniListId <= 0) {
      throw new Error("El ID de AniList no es válido.");
    }
    entry = await createAnimeTierListEntry({ seasonId, aniListId });
    const entryOverrides = {};
    if (input.animeImageUrl) entryOverrides.manualImageUrl = input.animeImageUrl;
    if (typeof input.animeIsAdultOverride === "string" && input.animeIsAdultOverride !== "") {
      entryOverrides.manualIsAdult = input.animeIsAdultOverride === "true";
    }
    if (typeof input.animeIsDonghuaOverride === "string" && input.animeIsDonghuaOverride !== "") {
      entryOverrides.manualIsDonghua = input.animeIsDonghuaOverride === "true";
    }
    if (Object.keys(entryOverrides).length > 0) {
      entry = { ...entry, ...entryOverrides };
      await prisma.animeTierListEntry.update({
        where: { id: entry.id },
        data: entryOverrides,
      });
    }
  } else {
    entry = await createManualAnimeTierListEntry({
      seasonId,
      title: input.animeTitle,
      imageUrl: input.animeImageUrl,
      isAdult: input.animeIsAdult,
      isDonghua: input.animeIsDonghua,
    });
  }

  const row = await prisma.animeTierListTheme.create({
    data: {
      tierListEntryId: entry.id,
      isManual: true,
      type,
      sequence,
      songTitle: input.songTitle || null,
      artist: input.artist || null,
      videoUrl,
      alternateVideoUrl: input.alternateVideoUrl?.trim() || null,
    },
  });
  return { ...compactTheme(row), animeTitle: entry.title };
}

export async function updateAnimeTierListTheme(input) {
  const prisma = getPrismaClient();
  const existing = await prisma.animeTierListTheme.findUnique({ where: { id: Number(input.id) } });
  if (!existing) {
    throw new Error("No se encontró el tema.");
  }

  const alternateVideoUrl = input.alternateVideoUrl === "" ? null : input.alternateVideoUrl;

  let data;
  if (existing.isManual) {
    // Un tema manual no tiene "fuente" que sobreescribir: los campos primarios son el valor real.
    const normalizedType = String(input.type || existing.type).toUpperCase();
    if (!["OP", "ED"].includes(normalizedType)) {
      throw new Error("El tipo debe ser OP o ED.");
    }
    const normalizedSequence = input.sequence ? Number(input.sequence) : existing.sequence;
    if (!Number.isInteger(normalizedSequence) || normalizedSequence < 1) {
      throw new Error("El número de secuencia no es válido.");
    }
    const videoUrl = String(input.videoUrl || "").trim() || existing.videoUrl;
    data = {
      type: normalizedType,
      sequence: normalizedSequence,
      videoUrl,
      songTitle: input.songTitle || null,
      artist: input.artist || null,
      alternateVideoUrl,
    };
  } else {
    const normalizedType = input.manualType ? String(input.manualType).toUpperCase() : null;
    if (normalizedType && !["OP", "ED"].includes(normalizedType)) {
      throw new Error("El tipo debe ser OP o ED.");
    }
    data = {
      manualType: normalizedType,
      manualSequence: input.manualSequence ? Number(input.manualSequence) : null,
      manualVideoUrl: input.manualVideoUrl === "" ? null : input.manualVideoUrl,
      manualSongTitle: input.manualSongTitle === "" ? null : input.manualSongTitle,
      manualArtist: input.manualArtist === "" ? null : input.manualArtist,
      alternateVideoUrl,
    };
  }
  // manualVisible ya no se edita desde este formulario (se controla vía ocultar/mostrar en el card); se preserva tal cual está.
  if (typeof input.manualVisible === "boolean") {
    data.manualVisible = input.manualVisible;
  }

  const row = await prisma.animeTierListTheme.update({ where: { id: existing.id }, data });

  let animeTitle = null;
  let animeImageUrl = null;
  const entryData = {};
  if (row.isManual && typeof input.manualEntryTitle === "string") {
    entryData.manualTitle = input.manualEntryTitle.trim() || null;
  }
  if (typeof input.manualEntryImageUrl === "string") {
    entryData.manualImageUrl = input.manualEntryImageUrl.trim() || null;
  }
  if (
    typeof input.manualEntryIsAdult === "boolean" || typeof input.manualEntryIsDonghua === "boolean"
    || typeof input.manualEntryIsAdultOverride === "string" || typeof input.manualEntryIsDonghuaOverride === "string"
  ) {
    // Sin ficha AniList: isAdult/isDonghua son campos directos. Con ficha AniList: son overrides
    // (manualIsAdult/manualIsDonghua) porque el sync de "Animes" refresca isAdult/isDonghua en cada corrida.
    const entryCheck = await prisma.animeTierListEntry.findUnique({
      where: { id: row.tierListEntryId },
      select: { aniListId: true },
    });
    if (!entryCheck?.aniListId) {
      if (typeof input.manualEntryIsAdult === "boolean") entryData.isAdult = input.manualEntryIsAdult;
      if (typeof input.manualEntryIsDonghua === "boolean") entryData.isDonghua = input.manualEntryIsDonghua;
    } else {
      if (typeof input.manualEntryIsAdultOverride === "string") {
        entryData.manualIsAdult = input.manualEntryIsAdultOverride === "true" ? true : input.manualEntryIsAdultOverride === "false" ? false : null;
      }
      if (typeof input.manualEntryIsDonghuaOverride === "string") {
        entryData.manualIsDonghua = input.manualEntryIsDonghuaOverride === "true" ? true : input.manualEntryIsDonghuaOverride === "false" ? false : null;
      }
    }
  }
  if (Object.keys(entryData).length > 0) {
    const entry = await prisma.animeTierListEntry.update({
      where: { id: row.tierListEntryId },
      data: entryData,
    });
    animeTitle = entry.manualTitle || entry.titleRomaji;
    animeImageUrl = entry.manualImageUrl || entry.imageUrl;
  }

  return { ...compactTheme(row), ...(animeTitle ? { animeTitle } : {}), ...(animeImageUrl ? { animeImageUrl } : {}) };
}

export async function deleteAnimeTierListTheme(id) {
  const prisma = getPrismaClient();
  const row = await prisma.animeTierListTheme.update({
    where: { id: Number(id) },
    data: { deletedAt: new Date() },
  });
  return compactTheme(row);
}

export async function restoreAnimeTierListTheme(id) {
  const prisma = getPrismaClient();
  const row = await prisma.animeTierListTheme.update({
    where: { id: Number(id) },
    data: { deletedAt: null },
  });
  return compactTheme(row);
}
