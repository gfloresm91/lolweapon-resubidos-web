import { categorizeTag } from "./tags.js";

import {
  LINK_PLATFORMS,
  LIVE_STATUSES,
  PENDING_LIVE_STATUS_LABEL,
  normalizeCatalogCode,
  toNullableString,
  toTrimmedString,
} from "./animeDbMapping.js";

const defaultLinkPlatformCodes = LINK_PLATFORMS.map((platform) => platform.code);

function parseLiveDate(value) {
  const [day, month, year] = String(value || "").split("/");
  const parsedDay = Number(day);
  const parsedMonth = Number(month);
  const parsedYear = Number(year);

  if (!parsedDay || !parsedMonth || !parsedYear) {
    return null;
  }

  return new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));
}

function formatLiveDate(value) {
  if (!value) {
    return "01/01/1900";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "01/01/1900";
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  return `${day}/${month}/${year}`;
}

function toNullableYear(value) {
  const year = Number(value);
  return Number.isFinite(year) ? Math.trunc(year) : null;
}

export async function ensureLiveCatalogs(prisma) {
  await Promise.all([
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

export async function readLiveStatuses(prisma) {
  await ensureLiveCatalogs(prisma);
  await prisma.liveStatus.updateMany({
    where: {
      code: { notIn: LIVE_STATUSES.map((status) => status.code) },
      sortOrder: 0,
    },
    data: { sortOrder: 1000 },
  });

  return prisma.liveStatus.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: "asc" },
      { label: "asc" },
    ],
    select: {
      code: true,
      label: true,
    },
  });
}

export async function ensureLiveStatus(prisma, value) {
  const label = toTrimmedString(value) || PENDING_LIVE_STATUS_LABEL;
  const code = normalizeCatalogCode(label) || "pendiente";
  const knownStatus = LIVE_STATUSES.find((status) => status.code === code);
  const sortOrder = knownStatus?.sortOrder ?? 1000;

  return prisma.liveStatus.upsert({
    where: { code },
    update: {
      label: knownStatus?.label || label,
      isActive: true,
      sortOrder,
    },
    create: {
      code,
      label: knownStatus?.label || label,
      sortOrder,
    },
  });
}

export async function ensureLinkPlatform(prisma, value) {
  const code = normalizeCatalogCode(value);

  if (!code) {
    return null;
  }

  const knownPlatform = LINK_PLATFORMS.find((platform) => platform.code === code);

  return prisma.linkPlatform.upsert({
    where: { code },
    update: {
      label: knownPlatform?.label || code,
      isActive: true,
      sortOrder: knownPlatform?.sortOrder || 0,
    },
    create: {
      code,
      label: knownPlatform?.label || code,
      sortOrder: knownPlatform?.sortOrder || 0,
    },
  });
}

export async function ensureLiveTag(prisma, value) {
  const name = toTrimmedString(value);
  const slug = String(name).toLowerCase().replace(/\s+/g, "");

  if (!name || !slug) {
    return null;
  }

  const categoryCode = categorizeTag(name);
  const category = await prisma.tagCategory.upsert({
    where: { code: categoryCode },
    update: { isActive: true, isCustom: false },
    create: { code: categoryCode, label: categoryCode, isCustom: false, sortOrder: 999 },
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

export async function saveLiveRecord(prisma, live) {
  const status = await ensureLiveStatus(prisma, live.status);
  const savedLive = await prisma.live.upsert({
    where: { legacyId: live.id },
    update: {
      title: live.title,
      date: parseLiveDate(live.date),
      year: toNullableYear(live.year),
      statusId: status.id,
      image: toNullableString(live.image),
      additionalInfo: toNullableString(live.additional_info),
    },
    create: {
      legacyId: live.id,
      title: live.title,
      date: parseLiveDate(live.date),
      year: toNullableYear(live.year),
      statusId: status.id,
      image: toNullableString(live.image),
      additionalInfo: toNullableString(live.additional_info),
    },
  });

  await prisma.liveTag.deleteMany({ where: { liveId: savedLive.id } });

  for (const [position, tagName] of (live.tags || []).entries()) {
    const tag = await ensureLiveTag(prisma, tagName);

    if (!tag) {
      continue;
    }

    await prisma.liveTag.upsert({
      where: {
        liveId_tagId: {
          liveId: savedLive.id,
          tagId: tag.id,
        },
      },
      update: {},
      create: {
        liveId: savedLive.id,
        tagId: tag.id,
        position,
      },
    });

    await prisma.liveTag.update({
      where: {
        liveId_tagId: {
          liveId: savedLive.id,
          tagId: tag.id,
        },
      },
      data: { position },
    });
  }

  await prisma.liveLink.deleteMany({ where: { liveId: savedLive.id } });

  for (const platformCode of defaultLinkPlatformCodes) {
    const platform = await ensureLinkPlatform(prisma, platformCode);
    const urls = Array.isArray(live.links?.[platformCode]) ? live.links[platformCode] : [];

    for (const [index, url] of urls.entries()) {
      await prisma.liveLink.create({
        data: {
          liveId: savedLive.id,
          platformId: platform.id,
          url,
          position: index,
        },
      });
    }
  }
}

export function compactLiveRecord(row) {
  const links = Object.fromEntries(defaultLinkPlatformCodes.map((code) => [code, []]));

  for (const link of row.links || []) {
    const code = link.platform?.code;

    if (!code) {
      continue;
    }

    if (!links[code]) {
      links[code] = [];
    }

    links[code].push(link.url);
  }

  return {
    id: row.legacyId,
    title: row.title || "Sin titulo",
    year: row.year == null ? "Sin año" : String(row.year),
    date: formatLiveDate(row.date),
    status: row.status?.label || PENDING_LIVE_STATUS_LABEL,
    tags: (row.tags || [])
      .map((liveTag) => liveTag.tag?.name)
      .filter(Boolean),
    links,
    image: row.image || "",
    additional_info: row.additionalInfo || "",
  };
}

export const liveIncludeForData = {
  status: true,
  tags: {
    include: {
      tag: true,
    },
    orderBy: {
      position: "asc",
    },
  },
  links: {
    include: {
      platform: true,
    },
    orderBy: [
      { platform: { sortOrder: "asc" } },
      { position: "asc" },
      { id: "asc" },
    ],
  },
};
