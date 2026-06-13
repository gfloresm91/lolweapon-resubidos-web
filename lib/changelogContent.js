import { newsGuideChangelog } from "@/lib/newsGuideContent";

const MODULE_MATCHERS = [
  { label: "SpaceDrum", patterns: ["spacedrum", "lector", "lectura", "capítulos", "páginas"] },
  { label: "Anime", patterns: ["anime", "chulopuntos", "viendo", "terminados", "biblioteca"] },
  { label: "Rastreador", patterns: ["directos", "rastreador", "vod", "eventsub", "twitch"] },
  { label: "Administración", patterns: ["admin", "mantenedor", "mantenedores", "roles", "usuarios", "auditoría", "historial"] },
  { label: "Perfil", patterns: ["perfil", "avatar", "login", "autenticación"] },
  { label: "Plataforma", patterns: ["documentación", "responsive", "ci/cd", "deploy", "build", "navegación"] },
];

function inferModules(release) {
  const haystack = [release.title, ...(release.changes || [])].join(" ").toLowerCase();
  const modules = MODULE_MATCHERS
    .filter((module) => module.patterns.some((pattern) => haystack.includes(pattern)))
    .map((module) => module.label);

  return modules.length ? Array.from(new Set(modules)) : ["Plataforma"];
}

function inferType(release) {
  const haystack = [release.title, ...(release.changes || [])].join(" ").toLowerCase();

  if (haystack.includes("corrección") || haystack.includes("correcciones") || haystack.includes("fix")) {
    return "Corrección";
  }

  if (haystack.includes("nuevo") || haystack.includes("nueva") || haystack.includes("sistema") || haystack.includes("mantenedor")) {
    return "Nuevo";
  }

  return "Mejora";
}

export const changelogEntries = newsGuideChangelog.map((release) => ({
  ...release,
  type: release.type || inferType(release),
  modules: release.modules || inferModules(release),
}));

export const changelogModules = Array.from(
  new Set(changelogEntries.flatMap((release) => release.modules)),
).sort((left, right) => left.localeCompare(right));

export const changelogTypes = Array.from(
  new Set(changelogEntries.map((release) => release.type)),
).sort((left, right) => left.localeCompare(right));
