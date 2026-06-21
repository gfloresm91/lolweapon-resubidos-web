import { PENDING_LIVE_STATUS_LABEL, normalizeCatalogCode } from "./animeDbMapping.js";

export const LIVE_STATUS_TONES = {
  live: {
    label: "En directo",
    badgeClassName: "status-badge--live",
    adminClassName: "is-live",
    calendarClassName: "is-live",
  },
  complete: {
    label: "Completo",
    badgeClassName: "status-badge--complete",
    adminClassName: "is-complete",
    calendarClassName: "is-complete",
  },
  completeAudio: {
    label: "Completo/Partes sin audio",
    badgeClassName: "status-badge--complete-audio",
    adminClassName: "is-complete-audio",
    calendarClassName: "is-complete-audio",
  },
  uploading: {
    label: "Subiendo",
    badgeClassName: "status-badge--uploading",
    adminClassName: "is-uploading",
    calendarClassName: "is-uploading",
  },
  pending: {
    label: "Pendiente",
    badgeClassName: "status-badge--pending",
    adminClassName: "is-pending",
    calendarClassName: "is-pending",
  },
  incomplete: {
    label: "Incompleto",
    badgeClassName: "status-badge--incomplete",
    adminClassName: "is-incomplete",
    calendarClassName: "is-incomplete",
  },
  incompleteAudio: {
    label: "Incompleto/Partes sin audio",
    badgeClassName: "status-badge--incomplete-audio",
    adminClassName: "is-incomplete-audio",
    calendarClassName: "is-incomplete-audio",
  },
  lost: {
    label: "Lost Media",
    badgeClassName: "status-badge--lost",
    adminClassName: "is-lost",
    calendarClassName: "is-lost",
  },
};

export const LIVE_STATUS_LEGEND_ITEMS = [
  LIVE_STATUS_TONES.live,
  LIVE_STATUS_TONES.complete,
  LIVE_STATUS_TONES.completeAudio,
  LIVE_STATUS_TONES.uploading,
  LIVE_STATUS_TONES.pending,
  LIVE_STATUS_TONES.incomplete,
  LIVE_STATUS_TONES.incompleteAudio,
  LIVE_STATUS_TONES.lost,
  {
    label: "Estados mixtos",
    calendarClassName: "is-mixed",
  },
];

export function getLiveStatusTone(status) {
  const code = normalizeCatalogCode(status || PENDING_LIVE_STATUS_LABEL);

  if (code.includes("lost")) return "lost";
  if (code.includes("incompleto") && code.includes("audio")) return "incompleteAudio";
  if (code.includes("incompleto")) return "incomplete";
  if (code.includes("completo") && code.includes("audio")) return "completeAudio";
  if (code.includes("completo")) return "complete";
  if (code.includes("subiendo")) return "uploading";
  if (code.includes("pendiente")) return "pending";
  if (code.includes("directo")) return "live";

  return "pending";
}

export function getLiveStatusMeta(status) {
  const tone = getLiveStatusTone(status);
  const meta = LIVE_STATUS_TONES[tone] || LIVE_STATUS_TONES.pending;

  return {
    ...meta,
    tone,
    dotClassName: `status-dot status-dot--${tone}`,
    badgeFullClassName: `status-badge ${meta.badgeClassName}`,
    adminFullClassName: `admin-user-status ${meta.adminClassName}`,
  };
}
