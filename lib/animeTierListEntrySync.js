import { buildAnimeTierListEntryImport } from "./animeTierListSources.js";
import { getPrismaClient } from "./prisma.js";

const VALID_SEASONS = new Set(["WINTER", "SPRING", "SUMMER", "FALL"]);

function validateSelection({ year, season }) {
  const normalizedYear = Number(year);
  const normalizedSeason = String(season || "").toUpperCase();
  if (!Number.isInteger(normalizedYear) || normalizedYear < 2000 || normalizedYear > 2100) {
    throw new Error("El año de la temporada no es válido.");
  }
  if (!VALID_SEASONS.has(normalizedSeason)) {
    throw new Error("La temporada no es válida.");
  }
  return { year: normalizedYear, season: normalizedSeason };
}

export async function previewAnimeTierListEntrySync(selection) {
  const normalized = validateSelection(selection);
  const payload = await buildAnimeTierListEntryImport(normalized);
  const prisma = getPrismaClient();
  const season = await prisma.animeSeason.findUnique({ where: { year_season: normalized } });
  const existing = season
    ? await prisma.animeTierListEntry.findMany({ where: { seasonId: season.id, isManual: false, deletedAt: null } })
    : [];
  const existingIds = new Set(existing.map((entry) => entry.aniListId));
  const incomingIds = new Set(payload.entries.map((entry) => entry.aniListId));

  return {
    selection: normalized,
    payload,
    summary: {
      entries: payload.entries.length,
      newEntries: payload.entries.filter((entry) => !existingIds.has(entry.aniListId)).length,
      missingEntries: Array.from(existingIds).filter((id) => !incomingIds.has(id)).length,
    },
  };
}

export async function applyAnimeTierListEntrySync(selection) {
  const preview = await previewAnimeTierListEntrySync(selection);
  const prisma = getPrismaClient();
  const normalized = preview.selection;
  const season = await prisma.animeSeason.upsert({
    where: { year_season: normalized },
    update: {},
    create: { ...normalized, status: "draft" },
  });

  await prisma.$transaction(async (tx) => {
    for (const entry of preview.payload.entries) {
      const data = {
        titleRomaji: entry.titleRomaji,
        titleEnglish: entry.titleEnglish,
        titleNative: entry.titleNative,
        imageUrl: entry.imageUrl,
        format: entry.format,
        episodes: entry.episodes,
        status: entry.status,
        aniListUrl: entry.aniListUrl,
        isAdult: entry.isAdult,
        isDonghua: entry.isDonghua,
        sourceUpdatedAt: entry.sourceUpdatedAt,
      };
      await tx.animeTierListEntry.upsert({
        where: { seasonId_aniListId: { seasonId: season.id, aniListId: entry.aniListId } },
        update: data,
        create: { seasonId: season.id, aniListId: entry.aniListId, ...data },
      });
    }
  }, { timeout: 60000 });

  return { seasonId: season.id, summary: preview.summary };
}
