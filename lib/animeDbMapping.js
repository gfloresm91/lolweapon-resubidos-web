export const ANIME_WATCH_STATUSES = [
  { code: "watching", label: "Comprado", sortOrder: 10 },
  { code: "completed", label: "Terminado", sortOrder: 20 },
  { code: "purchased", label: "Entera", sortOrder: 30 },
  { code: "paused", label: "Pausado", sortOrder: 40 },
  { code: "pending", label: "Pendiente", sortOrder: 50 },
  { code: "dropped", label: "Dropeado", sortOrder: 60 },
];

export const TAG_CATALOG_CATEGORIES = [
  { code: "anime", label: "Anime", icon: "AN", sortOrder: 10 },
  { code: "games", label: "Juegos", icon: "JG", sortOrder: 20 },
  { code: "tier", label: "Tiers", icon: "TR", sortOrder: 30 },
  { code: "chat", label: "Charlas", icon: "CH", sortOrder: 40 },
  { code: "movies", label: "Peliculas", icon: "MV", sortOrder: 50 },
  { code: "other", label: "Otros", icon: "OT", sortOrder: 999 },
];

export const LIVE_STATUSES = [
  { code: "completo", label: "Completo", sortOrder: 10 },
  { code: "pendiente", label: "Pendiente", sortOrder: 20 },
  { code: "lost-media", label: "Lost Media", sortOrder: 30 },
  { code: "subiendo", label: "Subiendo", sortOrder: 40 },
  { code: "incompleto", label: "Incompleto", sortOrder: 50 },
];

export const LIVE_STATUS_OPTIONS = LIVE_STATUSES.map(({ code, label }) => ({ code, label }));
export const DEFAULT_LIVE_STATUS_LABEL = LIVE_STATUS_OPTIONS[0]?.label || "Completo";
export const PENDING_LIVE_STATUS_LABEL = LIVE_STATUS_OPTIONS.find((status) => status.code === "pendiente")?.label || "Pendiente";

export const LINK_PLATFORMS = [
  { code: "okru", label: "OK.RU", sortOrder: 10 },
  { code: "telegram", label: "Telegram", sortOrder: 20 },
  { code: "piero", label: "Piero", sortOrder: 30 },
  { code: "patreon", label: "Patreon", sortOrder: 40 },
];

export function normalizeCatalogCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeUpperCatalogCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
}

export function toTrimmedString(value) {
  return String(value || "").trim();
}

export function toNullableString(value) {
  const text = toTrimmedString(value);
  return text || null;
}

export function toNullableInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

export function getPurchasedEpisodes(value) {
  if (String(value || "").trim().toUpperCase() === "ENTERA") {
    return null;
  }

  return toNullableInt(value);
}

export function getIsFullSeason(item) {
  return item?.watchStatus === "purchased" || String(item?.purchased || "").trim().toUpperCase() === "ENTERA";
}

export function toTagSlug(tag) {
  return String(tag || "").trim().toLowerCase().replace(/\s+/g, "");
}

export async function ensureAnimeCatalogs(prisma) {
  await Promise.all([
    ...ANIME_WATCH_STATUSES.map((status) => (
      prisma.animeWatchStatus.upsert({
        where: { code: status.code },
        update: status,
        create: status,
      })
    )),
    ...TAG_CATALOG_CATEGORIES.map((category) => (
      prisma.tagCategory.upsert({
        where: { code: category.code },
        update: { ...category, isCustom: false },
        create: { ...category, isCustom: false },
      })
    )),
    ...LIVE_STATUSES.map((status) => (
      prisma.liveStatus.upsert({
        where: { code: status.code },
        update: status,
        create: status,
      })
    )),
    ...LINK_PLATFORMS.map((platform) => (
      prisma.linkPlatform.upsert({
        where: { code: platform.code },
        update: platform,
        create: platform,
      })
    )),
  ]);
}

export async function ensureAnimeFormat(prisma, value) {
  const label = toTrimmedString(value);
  const code = normalizeUpperCatalogCode(value);

  if (!code) {
    return null;
  }

  return prisma.animeFormat.upsert({
    where: { code },
    update: {
      label,
      isActive: true,
    },
    create: {
      code,
      label,
    },
  });
}

export async function ensureAnimeReleaseStatus(prisma, value) {
  const label = toTrimmedString(value);
  const code = normalizeUpperCatalogCode(value);

  if (!code) {
    return null;
  }

  return prisma.animeReleaseStatus.upsert({
    where: { code },
    update: {
      label,
      isActive: true,
    },
    create: {
      code,
      label,
    },
  });
}

export async function ensureExternalProvider(prisma, value) {
  const code = normalizeCatalogCode(value);

  if (!code) {
    return null;
  }

  return prisma.externalProvider.upsert({
    where: { code },
    update: {
      name: code,
      isActive: true,
    },
    create: {
      code,
      name: code,
    },
  });
}

export async function ensureAnimeTag(prisma, value) {
  const name = toTrimmedString(value);
  const slug = toTagSlug(name);

  if (!name || !slug) {
    return null;
  }

  const category = await prisma.tagCategory.upsert({
    where: { code: "anime" },
    update: { label: "Anime", icon: "AN", isCustom: false, isActive: true, sortOrder: 10 },
    create: { code: "anime", label: "Anime", icon: "AN", isCustom: false, sortOrder: 10 },
  });

  return prisma.tag.upsert({
    where: { slug },
    update: {
      name,
      categoryId: category.id,
    },
    create: {
      name,
      slug,
      categoryId: category.id,
    },
  });
}

export function compactAnimeRecord(row) {
  const reference = row.externalReferences?.[0];
  const provider = reference?.provider;
  const libraryEntry = row.libraryEntry;
  const isFullSeason = Boolean(libraryEntry?.isFullSeason);
  const purchasedEpisodes = libraryEntry?.purchasedEpisodes;

  return {
    tag: libraryEntry?.trackerTag?.name || "",
    title: row.title || "",
    titleEs: row.titleEs || "",
    image: row.image || "",
    description: row.description || "",
    descriptionEs: row.descriptionEs || "",
    provider: provider?.code || "",
    providerId: reference?.providerMediaId ?? null,
    providerUrl: reference?.url || "",
    trackerUrl: libraryEntry?.trackerUrl || "",
    year: row.year,
    episodes: row.episodes,
    currentEpisode: libraryEntry?.currentEpisode == null ? "" : String(libraryEntry.currentEpisode),
    purchased: isFullSeason ? "ENTERA" : purchasedEpisodes == null ? "" : String(purchasedEpisodes),
    format: row.format?.label || row.format?.code || "",
    status: row.releaseStatus?.label || row.releaseStatus?.code || "",
    watchStatus: libraryEntry?.watchStatus?.code || "pending",
    libraryEnabled: libraryEntry?.libraryEnabled !== false,
    deletedAt: libraryEntry?.deletedAt ? libraryEntry.deletedAt.toISOString() : null,
  };
}

export const animeIncludeForMetadata = {
  format: true,
  releaseStatus: true,
  libraryEntry: {
    include: {
      watchStatus: true,
      trackerTag: true,
    },
  },
  externalReferences: {
    include: {
      provider: true,
    },
    orderBy: {
      id: "asc",
    },
  },
};
