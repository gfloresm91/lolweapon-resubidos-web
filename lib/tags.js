export const TAG_CATEGORIES = [
  { key: "anime", label: "Anime", icon: "🎌", keywords: ["anime", "naruto", "worldtrigger", "shingeki", "monogatari", "haruhi", "kuroshitsuji", "yurucamp", "jujutsu", "elfen", "takopi", "ranma", "dragonball"] },
  { key: "games", label: "Juegos", icon: "🎮", keywords: ["residentevil", "minecraft", "warhammer", "silenthill", "halo", "hollowknight", "deadcells", "slaythespire", "mortalkombat", "worldofwarcraft", "pokemon", "sekiro", "bloodborne", "codevein", "crashbandicoot"] },
  { key: "tier", label: "Tiers", icon: "📊", keywords: ["tieropenings", "tierendings"] },
  { key: "chat", label: "Charlas", icon: "💬", keywords: ["talkshows", "justchatting", "podcast"] },
  { key: "movies", label: "Peliculas", icon: "🎬", keywords: ["movie", "pelicula", "girls", "dolls", "loveexposure", "nobodyknows", "blue", "lilychouchou", "lastlight"] },
  { key: "other", label: "Otros", icon: "✨", keywords: [] },
];

export function normalizeTag(tag) {
  return String(tag || "").trim().toLowerCase().replace(/\s+/g, "");
}

export function categorizeTag(tag, overrides = {}) {
  const normalized = normalizeTag(tag);
  const override = overrides[normalized];

  if (override && TAG_CATEGORIES.some((category) => category.key === override)) {
    return override;
  }

  for (const category of TAG_CATEGORIES) {
    if (category.key === "other") {
      continue;
    }

    if (category.keywords.some((keyword) => normalized.includes(keyword))) {
      return category.key;
    }
  }

  return "other";
}

export function buildTagGroups(tags, overrides = {}) {
  const map = new Map(TAG_CATEGORIES.map((category) => [category.key, []]));

  for (const tag of tags) {
    const category = categorizeTag(tag, overrides);
    map.get(category)?.push(tag);
  }

  return TAG_CATEGORIES.map((category) => ({
    ...category,
    tags: (map.get(category.key) || []).sort((left, right) => left.localeCompare(right)),
  })).filter((category) => category.tags.length > 0);
}

