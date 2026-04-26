export const TAG_CATEGORIES = [
  {
    key: "anime",
    label: "Anime",
    icon: "🎌",
    exact: [
      "86eightysix",
      "dragonball",
      "dragonballz",
      "dragonballsuper",
      "worldtrigger",
    ],
    keywords: [
      "anime",
      "animacionjaponesa",
      "reaccionanime",
      "aldnoah",
      "arabaru",
      "bleach",
      "bocchi",
      "chainsawman",
      "dandadan",
      "deathnote",
      "demonlayer",
      "drstone",
      "elfenlied",
      "evangelion",
      "fate",
      "frieren",
      "girlsbandcry",
      "gurrenlagann",
      "haikyuu",
      "haruhi",
      "higurashi",
      "hunterxhunter",
      "jujutsu",
      "kaguya",
      "kimetsu",
      "konosuba",
      "kuroshitsuji",
      "madeinabyss",
      "madoka",
      "mashle",
      "mobpsycho",
      "monogatari",
      "mushoku",
      "naruto",
      "onepiece",
      "oshi",
      "ousamaranking",
      "ranma",
      "rezero",
      "shingeki",
      "spyxfamily",
      "takopi",
      "tokyoghoul",
      "vinlandsaga",
      "yurucamp",
    ],
  },
  {
    key: "games",
    label: "Juegos",
    icon: "🎮",
    exact: [
      "milkinsideabagofmilkinsideabagofmilk",
      "milkoutsideabagofmilkoutsideabagofmilk",
      "minecraft",
      "residentevil4",
    ],
    keywords: [
      "gameplay",
      "videojuego",
      "juegos",
      "bloodborne",
      "codevein",
      "crashbandicoot",
      "darksouls",
      "deadcells",
      "eldenring",
      "finalfantasy",
      "hollowknight",
      "leagueoflegends",
      "mortalkombat",
      "pokemon",
      "residentevil",
      "sekiro",
      "silenthill",
      "slaythespire",
      "warhammer",
      "worldofwarcraft",
      "zelda",
    ],
  },
  {
    key: "tier",
    label: "Tiers",
    icon: "📊",
    keywords: ["tier", "tierlist", "tieropenings", "tierendings"],
  },
  {
    key: "chat",
    label: "Charlas",
    icon: "💬",
    keywords: ["charla", "talkshows", "justchatting", "podcast", "reaccionvideos"],
  },
  {
    key: "movies",
    label: "Peliculas",
    icon: "🎬",
    exact: [
      "allaboutlilychouchou",
      "blue",
      "loveexposure",
      "nobodyknows",
      "rrr",
    ],
    keywords: [
      "cine",
      "film",
      "movie",
      "pelicula",
      "dolls",
      "lastlight",
      "lilychouchou",
    ],
  },
  { key: "other", label: "Otros", icon: "✨", keywords: [] },
];

export function normalizeTag(tag) {
  return String(tag || "").trim().toLowerCase().replace(/\s+/g, "");
}

export function categorizeTag(tag, overrides = {}, categories = TAG_CATEGORIES) {
  const normalized = normalizeTag(tag);
  const override = overrides[normalized];

  if (override && categories.some((category) => category.key === override)) {
    return override;
  }

  for (const category of categories) {
    if (category.key === "other") {
      continue;
    }

    if (category.exact?.includes(normalized)) {
      return category.key;
    }

    if (category.keywords.some((keyword) => normalized.includes(keyword))) {
      return category.key;
    }
  }

  return "other";
}

export function buildTagGroups(tags, overrides = {}, categories = TAG_CATEGORIES) {
  const map = new Map(categories.map((category) => [category.key, []]));

  for (const tag of tags) {
    const category = categorizeTag(tag, overrides, categories);
    const categoryTags = map.get(category) || map.get("other");
    categoryTags?.push(tag);
  }

  return categories.map((category) => ({
    ...category,
    tags: (map.get(category.key) || []).sort((left, right) => left.localeCompare(right)),
  })).filter((category) => category.tags.length > 0);
}
