function toTrimmedString(value) {
  return String(value ?? "").trim();
}

export function normalizeAnime(anime, index = 0) {
  const id = toTrimmedString(anime?.id) || `anime_${index}_${toTrimmedString(anime?.name).toLowerCase().replace(/\s+/g, "_")}`;
  const image = toTrimmedString(anime?.image);

  return {
    id,
    name: toTrimmedString(anime?.name) || "Sin nombre",
    current_episode: toTrimmedString(anime?.current_episode) || "0",
    purchased: toTrimmedString(anime?.purchased) || "0",
    image: image && !image.startsWith("/") ? `/${image}` : image,
    tracker_url: toTrimmedString(anime?.tracker_url),
  };
}

export function normalizeAnimes(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((anime, index) => normalizeAnime(anime, index));
}

export function sortAnimes(animes) {
  return [...normalizeAnimes(animes)].sort((left, right) => left.name.localeCompare(right.name));
}

export function isFullSeason(anime) {
  return String(anime?.purchased || "").trim().toUpperCase() === "ENTERA";
}
