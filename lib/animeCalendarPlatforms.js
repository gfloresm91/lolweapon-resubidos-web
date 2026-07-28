import { siAppletv, siBilibili, siCrunchyroll, siHbomax, siNetflix, siParamountplus, siYoutube } from "simple-icons";

// simple-icons trae el trazo oficial de cada marca; algunas (Apple TV, HBO Max) publican su hex oficial en negro puro,
// que se pierde sobre el fondo oscuro de la card, así que se sobreescribe solo el color en esos casos.
const PLATFORM_ICONS = {
  crunchyroll: { icon: siCrunchyroll },
  netflix: { icon: siNetflix },
  youtube: { icon: siYoutube },
  "apple tv": { icon: siAppletv, color: "#e5e7eb" },
  "apple tv+": { icon: siAppletv, color: "#e5e7eb" },
  bilibili: { icon: siBilibili },
  "bilibili tv": { icon: siBilibili },
  "hbo max": { icon: siHbomax, color: "#e5e7eb" },
  "paramount plus": { icon: siParamountplus },
  "paramount+": { icon: siParamountplus },
};

// Plataformas de anime frecuentes que simple-icons no tiene catalogadas: se muestran con iniciales.
const PLATFORM_FALLBACK_COLORS = {
  "disney+": "#60a5fa",
  hidive: "#38bdf8",
  funimation: "#a78bfa",
  "amazon prime video": "#38bdf8",
  "prime video": "#38bdf8",
  amazon: "#38bdf8",
  hulu: "#4ade80",
  vrv: "#fbbf24",
  wakanim: "#c084fc",
};

// Iniciales elegidas a mano para casos donde el recorte automático (primeras 2 letras) no se reconoce.
const PLATFORM_FALLBACK_LABELS = {
  "disney+": "D+",
  hulu: "H",
  amazon: "A",
};

export function getBadgeForeground(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return "#0b1017";
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#0b1017" : "#f8fafc";
}

export function getPlatformBadge(name) {
  const key = String(name || "").trim().toLowerCase();
  const iconDef = PLATFORM_ICONS[key];
  const color = iconDef ? (iconDef.color || `#${iconDef.icon.hex}`) : (PLATFORM_FALLBACK_COLORS[key] || "#94a3b8");
  const foreground = getBadgeForeground(color);
  if (iconDef) {
    return { path: iconDef.icon.path, color, foreground };
  }
  const initials = PLATFORM_FALLBACK_LABELS[key] || String(name || "").trim().slice(0, 2).toUpperCase() || "?";
  return { initials, color, foreground };
}
