import { PENDING_LIVE_STATUS_LABEL } from "./animeDbMapping.js";

function toTrimmedString(value) {
  return String(value || "").trim();
}

function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toTrimmedString(item))
    .filter(Boolean);
}

function normalizeLinks(links) {
  return {
    telegram: toStringArray(links?.telegram),
    okru: toStringArray(links?.okru),
    piero: toStringArray(links?.piero),
    patreon: toStringArray(links?.patreon),
  };
}

export function normalizeLive(live, index = 0) {
  const normalizedYear = toTrimmedString(live?.year);
  const normalizedDate = toTrimmedString(live?.date);

  return {
    id: toTrimmedString(live?.id) || `imported_${normalizedYear || "unknown"}_${index}`,
    title: toTrimmedString(live?.title) || "Sin titulo",
    year: normalizedYear || "Sin año",
    date: normalizedDate || "01/01/1900",
    status: toTrimmedString(live?.status) || PENDING_LIVE_STATUS_LABEL,
    tags: toStringArray(live?.tags),
    links: normalizeLinks(live?.links),
    image: toTrimmedString(live?.image),
    additional_info: toTrimmedString(live?.additional_info),
  };
}

export function normalizeLives(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((live, index) => normalizeLive(live, index));
}

export function sortLives(lives) {
  return [...normalizeLives(lives)].sort((left, right) => {
    const leftDate = left.date.split("/").reverse().join("-");
    const rightDate = right.date.split("/").reverse().join("-");
    return rightDate.localeCompare(leftDate);
  });
}
