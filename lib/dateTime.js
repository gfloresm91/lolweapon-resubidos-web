const PLATFORM_TIME_ZONE = "America/Santiago";
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function getZonedDateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: PLATFORM_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function formatPlatformDateTime(value) {
  if (!value) {
    return "";
  }

  const parts = getZonedDateParts(value);
  if (!parts) {
    return "";
  }

  const month = MONTHS_ES[Math.max(0, Number(parts.month) - 1)] || parts.month;
  return `${parts.day} ${month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}
