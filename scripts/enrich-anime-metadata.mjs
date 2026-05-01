import { access, readFile, writeFile } from "node:fs/promises";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const BASE_METADATA_FILE = "data/anime-metadata.json";
const LOCAL_METADATA_FILE = "data/anime-metadata.local.json";
const DEFAULT_DELAY_MS = 2300;
const MAX_RATE_LIMIT_RETRIES = 3;

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const shouldForceImages = args.has("--force-images");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

const query = `
  query SearchAnime($search: String!) {
    Media(search: $search, type: ANIME) {
      id
      idMal
      siteUrl
      title {
        romaji
        english
        native
      }
      description(asHtml: false)
      format
      status
      episodes
      startDate {
        year
      }
      coverImage {
        extraLarge
        large
      }
    }
  }
`;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveMetadataFile() {
  if (await fileExists(LOCAL_METADATA_FILE)) {
    return LOCAL_METADATA_FILE;
  }

  return BASE_METADATA_FILE;
}

function titleFromTag(tag) {
  return String(tag || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function compactTitle(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanDescription(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getDisplayTitle(media) {
  return media?.title?.english || media?.title?.romaji || media?.title?.native || "";
}

function buildSearchCandidates(key, item) {
  const candidates = [
    item.titleEs,
    item.title,
    item.tag,
    titleFromTag(item.tag),
    titleFromTag(key),
  ];

  return [...new Set(candidates.map((candidate) => String(candidate || "").trim()).filter(Boolean))];
}

function shouldReplaceTitle(item, key) {
  const currentTitle = String(item.title || "").trim();

  if (!currentTitle) {
    return true;
  }

  return compactTitle(currentTitle) === compactTitle(titleFromTag(item.tag || key));
}

async function searchAnime(search) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { search },
      }),
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") || 60);

      if (attempt < MAX_RATE_LIMIT_RETRIES) {
        console.log(`  AniList rate limit, esperando ${retryAfter}s...`);
        await sleep((retryAfter + 1) * 1000);
        continue;
      }

      throw new Error(`AniList rate limit. Reintenta en ${retryAfter}s.`);
    }

    const data = await response.json();

    if (!response.ok || data.errors?.length) {
      const message = data.errors?.[0]?.message || `AniList respondio ${response.status}`;
      throw new Error(message);
    }

    return data.data?.Media || null;
  }

  return null;
}

async function findAnime(key, item) {
  const candidates = buildSearchCandidates(key, item);

  for (const candidate of candidates) {
    const media = await searchAnime(candidate);

    if (media) {
      return { media, search: candidate };
    }
  }

  return { media: null, search: candidates[0] || key };
}

const metadataFile = await resolveMetadataFile();
console.log(`Usando metadata: ${metadataFile}`);

const rawMetadata = await readFile(metadataFile, "utf8");
const metadata = JSON.parse(rawMetadata);
const entries = Object.entries(metadata);
let enriched = 0;
let skipped = 0;
let failed = 0;
let attempted = 0;

for (const [key, item] of entries) {
  if (item.libraryEnabled === false) {
    skipped += 1;
    continue;
  }

  const needsMetadata = !item.providerId
    || !item.provider
    || !item.providerUrl
    || !item.year
    || !item.episodes
    || !item.format
    || !item.status
    || !item.description
    || !item.image
    || shouldReplaceTitle(item, key);

  if (!needsMetadata) {
    skipped += 1;
    continue;
  }

  if (attempted >= limit) {
    break;
  }

  attempted += 1;

  try {
    const { media, search } = await findAnime(key, item);

    if (!media) {
      failed += 1;
      console.log(`- Sin resultado: ${item.tag || key}`);
      await sleep(DEFAULT_DELAY_MS);
      continue;
    }

    const nextItem = { ...item };
    const providerTitle = getDisplayTitle(media);
    const providerImage = media.coverImage?.extraLarge || media.coverImage?.large || "";

    if (providerTitle && shouldReplaceTitle(item, key)) {
      nextItem.title = providerTitle;
    }

    if (providerImage && (shouldForceImages || !nextItem.image)) {
      nextItem.image = providerImage;
    }

    nextItem.description = nextItem.description || cleanDescription(media.description);
    nextItem.provider = "anilist";
    nextItem.providerId = media.id;
    nextItem.providerUrl = media.siteUrl || `https://anilist.co/anime/${media.id}`;
    nextItem.year = nextItem.year || media.startDate?.year || null;
    nextItem.episodes = nextItem.episodes || media.episodes || null;
    nextItem.format = nextItem.format || media.format || "";
    nextItem.status = nextItem.status || media.status || "";

    metadata[key] = nextItem;
    enriched += 1;
    console.log(`✓ ${item.tag || key} -> ${providerTitle || media.id} (${search})`);
  } catch (error) {
    failed += 1;
    console.log(`! ${item.tag || key}: ${error.message}`);
  }

  await sleep(DEFAULT_DELAY_MS);
}

if (!isDryRun) {
  await writeFile(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

console.log("");
console.log(JSON.stringify({
  dryRun: isDryRun,
  attempted,
  enriched,
  skipped,
  failed,
}, null, 2));
