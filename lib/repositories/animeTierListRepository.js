import crypto from "node:crypto";

import { getPrismaClient } from "../prisma.js";

const DEFAULT_TIER_PALETTE = [
  { label: "S", color: "#d64545" },
  { label: "A", color: "#e08a3c" },
  { label: "B", color: "#d4b23c" },
  { label: "C", color: "#4caf6e" },
  { label: "D", color: "#3f8fd1" },
  { label: "F", color: "#7c6fd6" },
];
const MAX_TIERS = 20;
const MAX_LABEL_LENGTH = 40;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function usePostgres() {
  return String(process.env.DATA_SOURCE || "").toLowerCase() === "postgres";
}

function compactSeason(season) {
  if (!season) return null;
  return { id: season.id, year: season.year, season: season.season, status: season.status };
}

async function listAnimeSeasonsForTierList() {
  const prisma = getPrismaClient();
  const rows = await prisma.animeSeason.findMany({ orderBy: [{ year: "desc" }, { season: "asc" }] });
  return rows.map(compactSeason);
}

function resolveSeason(seasons, seasonId) {
  const hasRequestedId = seasonId !== null && seasonId !== undefined && String(seasonId).trim() !== "";
  if (hasRequestedId) {
    return seasons.find((season) => season.id === Number(seasonId)) || null;
  }
  return seasons.find((season) => season.status === "active") || seasons[0] || null;
}

function buildDefaultTiers() {
  return DEFAULT_TIER_PALETTE.map((tier, index) => ({
    key: `default-${index}`,
    label: tier.label,
    color: tier.color,
    position: index,
  }));
}

export async function getAnimeRosterForSeason(seasonId) {
  const prisma = getPrismaClient();
  const rows = await prisma.animeTierListEntry.findMany({ where: { seasonId } });
  return rows.map((row) => ({
    id: row.id,
    aniListId: row.aniListId,
    title: row.manualTitle || row.titleRomaji,
    imageUrl: row.manualImageUrl || row.imageUrl,
    isAdult: row.manualIsAdult ?? row.isAdult,
    isDonghua: row.manualIsDonghua ?? row.isDonghua,
    isHidden: Boolean(row.deletedAt) || row.manualVisible === false,
  }));
}

async function getThemeRosterForSeason(seasonId, kind) {
  const prisma = getPrismaClient();
  const rows = await prisma.animeTierListTheme.findMany({
    where: { entry: { seasonId } },
    include: { entry: true },
  });
  const wantedType = kind === "ed" ? "ED" : "OP";

  return rows
    .map((row) => {
      const effectiveType = row.manualType || row.type;
      if (effectiveType !== wantedType) return null;
      const entryHidden = Boolean(row.entry?.deletedAt) || row.entry?.manualVisible === false;
      return {
        id: row.id,
        tierListEntryId: row.tierListEntryId,
        aniListId: row.entry?.aniListId ?? null,
        animeTitle: row.entry?.manualTitle || row.entry?.titleRomaji || "",
        imageUrl: row.entry?.manualImageUrl || row.entry?.imageUrl || null,
        sequence: row.manualSequence ?? row.sequence,
        songTitle: row.manualSongTitle || row.songTitle,
        artist: row.manualArtist || row.artist,
        videoUrl: row.manualVideoUrl || row.videoUrl,
        alternateVideoUrl: row.alternateVideoUrl || null,
        isAdult: row.entry?.manualIsAdult ?? row.entry?.isAdult ?? false,
        isDonghua: row.entry?.manualIsDonghua ?? row.entry?.isDonghua ?? false,
        isSpoiler: row.isSpoiler,
        isHidden: entryHidden || Boolean(row.deletedAt) || row.manualVisible === false,
        type: row.type,
        manualType: row.manualType,
        rawSequence: row.sequence,
        manualSequence: row.manualSequence,
        rawVideoUrl: row.videoUrl,
        manualVideoUrl: row.manualVideoUrl,
        rawSongTitle: row.songTitle,
        manualSongTitle: row.manualSongTitle,
        rawArtist: row.artist,
        manualArtist: row.manualArtist,
        manualIsAdult: row.entry?.manualIsAdult ?? null,
        manualIsDonghua: row.entry?.manualIsDonghua ?? null,
        manualVisible: row.manualVisible,
        isManual: row.isManual,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      left.animeTitle.localeCompare(right.animeTitle) || left.sequence - right.sequence
    ));
}

async function getRosterForKind({ kind, seasonId }) {
  if (kind === "animes") return getAnimeRosterForSeason(seasonId);
  return getThemeRosterForSeason(seasonId, kind);
}

export async function getEntriesWithoutThemeForSeason(seasonId, kind) {
  const prisma = getPrismaClient();
  const wantedType = kind === "ed" ? "ED" : "OP";
  const entries = await prisma.animeTierListEntry.findMany({
    where: { seasonId: Number(seasonId), deletedAt: null },
    include: { themes: { where: { deletedAt: null } } },
  });

  return entries
    .filter((entry) => !entry.themes.some((theme) => (theme.manualType || theme.type) === wantedType))
    .map((entry) => ({
      id: entry.id,
      aniListId: entry.aniListId,
      title: entry.manualTitle || entry.titleRomaji,
      imageUrl: entry.manualImageUrl || entry.imageUrl,
      isAdult: entry.manualIsAdult ?? entry.isAdult,
      isDonghua: entry.manualIsDonghua ?? entry.isDonghua,
      manualIsAdult: entry.manualIsAdult,
      manualIsDonghua: entry.manualIsDonghua,
      isHidden: entry.manualVisible === false,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
}

function validateTiers(tiers) {
  const list = Array.isArray(tiers) ? tiers : [];
  if (list.length > MAX_TIERS) {
    throw new Error("Hay demasiadas filas en el tablero.");
  }
  return list.map((tier) => {
    const label = String(tier?.label || "").trim().slice(0, MAX_LABEL_LENGTH);
    if (!label) throw new Error("Cada fila necesita un nombre.");
    const color = HEX_COLOR_PATTERN.test(tier?.color) ? tier.color : "#8b5cf6";
    const key = String(tier?.key ?? "").trim();
    if (!key) throw new Error("Cada fila necesita un identificador.");
    return { key, label, color };
  });
}

function validatePlacements(placements, tiers) {
  const validKeys = new Set(tiers.map((tier) => tier.key));
  const list = Array.isArray(placements) ? placements : [];
  return list.map((placement) => {
    const itemId = Number(placement?.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new Error("Hay un elemento inválido en el tablero.");
    }
    const tierKey = placement?.tierKey === null || placement?.tierKey === undefined
      ? null
      : String(placement.tierKey);
    if (tierKey !== null && !validKeys.has(tierKey)) {
      throw new Error("Hay una fila inválida en el tablero.");
    }
    return { itemId, tierKey };
  });
}

export async function getAnimeTierListBoard({ kind, seasonId, userId }) {
  const emptyBoard = { seasons: [], season: null, roster: [], tiers: [], placements: [], isPublic: false, shareToken: null };
  if (!usePostgres()) return emptyBoard;

  const prisma = getPrismaClient();
  const seasons = await listAnimeSeasonsForTierList();
  const selected = resolveSeason(seasons, seasonId);
  if (!selected) return { ...emptyBoard, seasons };

  const roster = await getRosterForKind({ kind, seasonId: selected.id });

  let tierList = null;
  if (userId) {
    tierList = await prisma.platformUserAnimeTierList.findUnique({
      where: { userId_seasonId_kind: { userId, seasonId: selected.id, kind } },
      include: { tiers: { orderBy: { position: "asc" } }, placements: { orderBy: { position: "asc" } } },
    });
  }

  const tiers = tierList
    ? tierList.tiers.map((tier) => ({ key: String(tier.id), label: tier.label, color: tier.color }))
    : buildDefaultTiers();
  const placements = tierList
    ? tierList.placements.map((placement) => ({
      itemId: placement.itemId,
      tierKey: placement.tierId == null ? null : String(placement.tierId),
    }))
    : [];

  return {
    seasons,
    season: selected,
    roster,
    tiers,
    placements,
    isPublic: tierList?.isPublic || false,
    shareToken: tierList?.isPublic ? tierList.shareToken : null,
  };
}

export async function saveAnimeTierListBoard({ userId, seasonId, kind, tiers, placements }) {
  if (!userId) throw new Error("Inicia sesión para guardar tu tier list.");
  const normalizedSeasonId = Number(seasonId);
  if (!Number.isInteger(normalizedSeasonId) || normalizedSeasonId <= 0) {
    throw new Error("Selecciona una temporada válida.");
  }
  const normalizedTiers = validateTiers(tiers);
  const normalizedPlacements = validatePlacements(placements, normalizedTiers);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const tierList = await tx.platformUserAnimeTierList.upsert({
      where: { userId_seasonId_kind: { userId, seasonId: normalizedSeasonId, kind } },
      update: { updatedAt: new Date() },
      create: { userId, seasonId: normalizedSeasonId, kind },
    });

    await tx.platformUserAnimeTierPlacement.deleteMany({ where: { tierListId: tierList.id } });
    await tx.platformUserAnimeTier.deleteMany({ where: { tierListId: tierList.id } });

    const keyToDbId = new Map();
    for (const [index, tier] of normalizedTiers.entries()) {
      const row = await tx.platformUserAnimeTier.create({
        data: { tierListId: tierList.id, label: tier.label, color: tier.color, position: index },
      });
      keyToDbId.set(tier.key, row.id);
    }

    for (const [index, placement] of normalizedPlacements.entries()) {
      await tx.platformUserAnimeTierPlacement.create({
        data: {
          tierListId: tierList.id,
          tierId: placement.tierKey === null ? null : keyToDbId.get(placement.tierKey) ?? null,
          itemId: placement.itemId,
          position: index,
        },
      });
    }

    return { tierListId: tierList.id };
  }, { timeout: 30000 });
}

export async function resetAnimeTierListBoard({ userId, seasonId, kind }) {
  if (!userId) throw new Error("Inicia sesión para reiniciar tu tier list.");
  const prisma = getPrismaClient();
  await prisma.platformUserAnimeTierList.deleteMany({
    where: { userId, seasonId: Number(seasonId), kind },
  });
  return { seasonId: Number(seasonId), kind };
}

export async function setAnimeTierListVisibility({ userId, seasonId, kind, isPublic }) {
  if (!userId) throw new Error("Inicia sesión para compartir tu tier list.");
  const normalizedSeasonId = Number(seasonId);
  const prisma = getPrismaClient();

  const tierList = await prisma.platformUserAnimeTierList.upsert({
    where: { userId_seasonId_kind: { userId, seasonId: normalizedSeasonId, kind } },
    update: {},
    create: { userId, seasonId: normalizedSeasonId, kind },
  });

  const shareToken = isPublic
    ? (tierList.shareToken || crypto.randomBytes(16).toString("hex"))
    : tierList.shareToken;

  const updated = await prisma.platformUserAnimeTierList.update({
    where: { id: tierList.id },
    data: { isPublic: Boolean(isPublic), shareToken },
  });

  return { isPublic: updated.isPublic, shareToken: updated.isPublic ? updated.shareToken : null };
}

export async function getPublicAnimeTierListByShareToken(shareToken) {
  if (!usePostgres() || !shareToken) return null;
  const prisma = getPrismaClient();
  const tierList = await prisma.platformUserAnimeTierList.findFirst({
    where: { shareToken, isPublic: true },
    include: {
      user: { select: { alias: true, login: true } },
      season: true,
      tiers: { orderBy: { position: "asc" } },
      placements: { orderBy: { position: "asc" } },
    },
  });
  if (!tierList) return null;

  const roster = await getRosterForKind({ kind: tierList.kind, seasonId: tierList.seasonId });

  return {
    owner: tierList.user,
    season: compactSeason(tierList.season),
    kind: tierList.kind,
    roster,
    tiers: tierList.tiers.map((tier) => ({ key: String(tier.id), label: tier.label, color: tier.color })),
    placements: tierList.placements.map((placement) => ({
      itemId: placement.itemId,
      tierKey: placement.tierId == null ? null : String(placement.tierId),
    })),
    updatedAt: tierList.updatedAt,
  };
}
