import { z } from "zod";

export const PASSWORD_MAX_LENGTH = 72;
export const LOGIN_MAX_LENGTH = 32;
export const ALIAS_MAX_LENGTH = 40;
export const EMAIL_MAX_LENGTH = 254;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const LOGIN_PATTERN = /^[a-zA-Z0-9._-]+$/;
export const ALIAS_PATTERN = /^[\p{L}\p{N} _.-]+$/u;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_RULES = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(PASSWORD_MAX_LENGTH, "La contraseña no puede superar 72 caracteres.")
  .regex(/\p{L}/u, "La contraseña debe incluir al menos una letra.")
  .regex(/\p{N}/u, "La contraseña debe incluir al menos un número.");

// Un solo mensaje para las 3 condiciones, igual que el backend (registerManualUser en
// lib/repositories/platformUserRepository.js), que valida longitud y patrón en un único chequeo.
export const LOGIN_RULES = z
  .string()
  .trim()
  .refine((value) => value.length >= 3 && value.length <= LOGIN_MAX_LENGTH && LOGIN_PATTERN.test(value), {
    message: "El usuario debe tener 3 a 32 caracteres: letras, números, punto, guion o guion bajo.",
  });

export const ALIAS_RULES = z
  .string()
  .trim()
  .min(1, "El alias es obligatorio.")
  .min(2, "El alias debe tener al menos 2 caracteres.")
  .max(ALIAS_MAX_LENGTH, "El alias no puede superar 40 caracteres.")
  .regex(ALIAS_PATTERN, "Usa letras, números, espacios, punto, guion o guion bajo.");

export const EMAIL_RULES = z
  .string()
  .trim()
  .min(1, "El email es obligatorio.")
  .max(EMAIL_MAX_LENGTH, "El email no puede superar 254 caracteres.")
  .email("Ingresa un email válido.");

export function getPasswordStrength(password) {
  const value = String(password || "");
  let score = 0;

  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/\p{L}/u.test(value)) score += 1;
  if (/\p{N}/u.test(value)) score += 1;
  if (/[^\p{L}\p{N}]/u.test(value)) score += 1;

  if (!value) return { score: 0, tone: "empty", label: "Sin contraseña" };
  if (score <= 2) return { score, tone: "weak", label: "Débil" };
  if (score <= 4) return { score, tone: "medium", label: "Media" };
  return { score, tone: "strong", label: "Fuerte" };
}

export function validateProfileFields(form) {
  const alias = String(form?.alias || "").trim();
  const email = String(form?.email || "").trim().toLowerCase();

  if (!alias) return "El alias es obligatorio.";
  if (alias.length < 2) return "El alias debe tener al menos 2 caracteres.";
  if (alias.length > 40) return "El alias no puede superar 40 caracteres.";
  if (!ALIAS_PATTERN.test(alias)) return "Usa letras, números, espacios, punto, guion o guion bajo.";
  if (!email) return "El email es obligatorio.";
  if (email.length > EMAIL_MAX_LENGTH) return "El email no puede superar 254 caracteres.";
  if (!EMAIL_PATTERN.test(email)) return "Ingresa un email válido.";

  return "";
}

export function validatePasswordChangeFields(form, { requireCurrentPassword = true } = {}) {
  const password = String(form?.password || "");
  const confirmPassword = String(form?.confirmPassword || "");

  if (requireCurrentPassword && !form?.currentPassword) return "Ingresa tu contraseña actual.";
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (password.length > PASSWORD_MAX_LENGTH) return "La contraseña no puede superar 72 caracteres.";
  if (!/\p{L}/u.test(password)) return "La contraseña debe incluir al menos una letra.";
  if (!/\p{N}/u.test(password)) return "La contraseña debe incluir al menos un número.";
  if (!confirmPassword) return "Confirma tu contraseña.";
  if (confirmPassword.length > PASSWORD_MAX_LENGTH) return "La confirmación no puede superar 72 caracteres.";
  if (password !== confirmPassword) return "Las contraseñas no coinciden.";

  return "";
}

export function getProfileErrorField(message) {
  if (message.includes("usuario")) return "login";
  if (message.includes("alias")) return "alias";
  if (message.includes("email")) return "email";
  if (message.includes("avatar") || message.includes("imagen")) return "avatarUrl";
  return "form";
}

export function getPasswordErrorField(message) {
  if (message.includes("actual")) return "currentPassword";
  if (message.includes("coinciden") || message.includes("confirmación") || message.includes("Confirma")) return "confirmPassword";
  if (message.includes("nueva")) return "password";
  if (message.includes("contraseña")) return "password";
  return "form";
}
