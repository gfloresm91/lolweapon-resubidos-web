import { z } from "zod";

export const TRACKER_TITLE_MAX_LENGTH = 140;
export const TRACKER_TAG_MAX_LENGTH = 48;
export const TRACKER_TAGS_MAX_COUNT = 12;
export const TRACKER_INFO_MAX_LENGTH = 1200;

export function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isValidTrackerUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateStringLinksField(value, context) {
  const invalidLink = splitLines(value).find((link) => !isValidTrackerUrl(link));

  if (invalidLink) {
    context.addIssue({
      code: "custom",
      message: "Cada enlace debe ser una URL válida.",
    });
  }
}

function validateArrayLinksField(value, context) {
  const invalidLink = (Array.isArray(value) ? value : []).find((link) => !isValidTrackerUrl(link));

  if (invalidLink) {
    context.addIssue({
      code: "custom",
      message: "Cada enlace debe ser una URL válida.",
    });
  }
}

export const trackerLiveFormSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio.").max(TRACKER_TITLE_MAX_LENGTH, "El título no puede superar 140 caracteres."),
  year: z.string().trim().min(1, "El año es obligatorio.").regex(/^\d{4}$/, "El año debe tener 4 dígitos."),
  date: z.string().trim().min(1, "La fecha de emisión es obligatoria.").regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida."),
  status: z.string().trim().min(1, "El estado es obligatorio."),
  tags: z.array(z.string().trim().min(1).max(TRACKER_TAG_MAX_LENGTH, "Cada tag no puede superar 48 caracteres."))
    .max(TRACKER_TAGS_MAX_COUNT, "No puedes agregar más de 12 tags.")
    .default([]),
  additional_info: z.string().max(TRACKER_INFO_MAX_LENGTH, "La información adicional no puede superar 1200 caracteres.").optional(),
  links: z.object({
    telegram: z.string(),
    okru: z.string(),
    piero: z.string(),
    patreon: z.string(),
  }).superRefine((links, context) => {
    for (const platform of ["telegram", "okru", "piero", "patreon"]) {
      validateStringLinksField(links[platform], {
        addIssue: (issue) => context.addIssue({ ...issue, path: [platform] }),
      });
    }
  }),
});

export const trackerLivePayloadSchema = z.object({
  id: z.string().trim().min(1, "El código del directo es obligatorio.").optional(),
  title: z.string().trim().min(1, "El título es obligatorio.").max(TRACKER_TITLE_MAX_LENGTH, "El título no puede superar 140 caracteres."),
  year: z.string().trim().min(1, "El año es obligatorio.").regex(/^\d{4}$/, "El año debe tener 4 dígitos."),
  date: z.string().trim().min(1, "La fecha de emisión es obligatoria.").regex(/^\d{2}\/\d{2}\/\d{4}$/, "Selecciona una fecha válida."),
  status: z.string().trim().min(1, "El estado es obligatorio."),
  tags: z.array(z.string().trim().min(1).max(TRACKER_TAG_MAX_LENGTH, "Cada tag no puede superar 48 caracteres."))
    .max(TRACKER_TAGS_MAX_COUNT, "No puedes agregar más de 12 tags.")
    .default([]),
  image: z.string().optional().default(""),
  additional_info: z.string().max(TRACKER_INFO_MAX_LENGTH, "La información adicional no puede superar 1200 caracteres.").optional().default(""),
  links: z.object({
    telegram: z.array(z.string()).default([]),
    okru: z.array(z.string()).default([]),
    piero: z.array(z.string()).default([]),
    patreon: z.array(z.string()).default([]),
  }).superRefine((links, context) => {
    for (const platform of ["telegram", "okru", "piero", "patreon"]) {
      validateArrayLinksField(links[platform], {
        addIssue: (issue) => context.addIssue({ ...issue, path: [platform] }),
      });
    }
  }),
}).passthrough();

export function getTrackerValidationMessage(error) {
  return error?.issues?.[0]?.message || "Revisa los datos del directo.";
}
