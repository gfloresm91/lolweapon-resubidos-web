const PLATFORM_TIME_ZONE = "America/Santiago";

export function formatPlatformDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PLATFORM_TIME_ZONE,
  }).format(new Date(value));
}
