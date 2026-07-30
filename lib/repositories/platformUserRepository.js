import crypto from "node:crypto";

import { getPrismaClient } from "../prisma.js";
import { ALIAS_PATTERN, EMAIL_MAX_LENGTH, EMAIL_PATTERN } from "../platformUserValidation.js";

const SESSION_DAYS = 14;
const DEFAULT_ROLE_CODE = "publico";
const GUEST_ROLE_CODE = "invitado";
const BOOTSTRAP_ROLE_CODE = "dios";
const RATING_WRITE_PERMISSION_CODE = "anime.rating.write";
const STREAMER_RATING_PERMISSION_CODE = "anime.rating.streamer";
const TRACKER_CALENDAR_PERMISSION_CODE = "tracker.calendar.view";
const ANIME_CALENDAR_PERMISSION_CODE = "anime.calendar.view";
const ANIME_TIER_LIST_ANIMES_PERMISSION_CODE = "anime.tierlist.animes.view";
const ANIME_TIER_LIST_OPENINGS_PERMISSION_CODE = "anime.tierlist.openings.view";
const ANIME_TIER_LIST_OPENINGS_MANAGE_PERMISSION_CODE = "anime.tierlist.openings.manage";
const ANIME_TIER_LIST_OPENINGS_MANAGE_DEFAULT_ROLE_CODES = ["admin", "moderador", "streamer"];
const GOD_EXCLUDED_PERMISSION_CODES = new Set([STREAMER_RATING_PERMISSION_CODE]);
const TRACKER_CALENDAR_DEFAULT_ROLE_CODES = ["tw-tier-1", "tw-tier-2", "tw-tier-3", "yt-miembro"];
const ANIME_CALENDAR_DEFAULT_ROLE_CODES = ["tw-tier-1", "tw-tier-2", "tw-tier-3", "moderador", "admin", "streamer"];
const SUPPORT_TICKET_DEFAULT_ROLE_CODES = ["dios", "admin", "moderador", "tw-tier-1", "tw-tier-2", "tw-tier-3", "tw-vip", "yt-miembro", "publico"];
const PROTECTED_ROLE_CODES = new Set([BOOTSTRAP_ROLE_CODE, GUEST_ROLE_CODE]);
const LEGACY_ROLE_MAP = {
  admin: "admin",
  moderator: "moderador",
  viewer: "publico",
};
const PASSWORD_KEY_LENGTH = 64;
const ROLE_INCLUDE = { permissions: { include: { permission: true } } };
const USER_INCLUDE = { role: { include: ROLE_INCLUDE }, authIdentities: true };
const TWITCH_AUTOMATIC_ROLE_CODES = new Set(["publico", "moderador", "tw-vip", "tw-tier-1", "tw-tier-2", "tw-tier-3"]);
const GOD_ROLE_CODE = BOOTSTRAP_ROLE_CODE;
const ADMIN_PERMISSION_CODES = [
  "home.view",
  "support.tickets.view",
  "support.tickets.create",
  "rtfm.view",
  "news.view",
  "changelog.view",
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
  "roles.read",
  "roles.create",
  "roles.update",
  "admin.tickets.view",
  "admin.tickets.update",
  "admin.tracker.view",
  "admin.tags.view",
  "tags.create",
  "tags.update",
  "tags.delete",
  "admin.anime.tracking.view",
  "admin.anime.completed.view",
  "admin.anime.calendar.view",
  "admin.anime.calendar.sync",
  "admin.anime.calendar.update",
  "admin.anime.tierlist.animes.view",
  "admin.anime.tierlist.animes.sync",
  "admin.anime.tierlist.animes.create",
  "admin.anime.tierlist.animes.update",
  "admin.anime.tierlist.animes.delete",
  "admin.anime.tierlist.openings.view",
  "admin.anime.tierlist.openings.sync",
  "admin.anime.tierlist.openings.create",
  "admin.anime.tierlist.openings.update",
  "admin.anime.tierlist.openings.delete",
  "anime.tracking.view",
  "anime.tracking.create",
  "anime.tracking.update",
  "anime.tracking.delete",
  "anime.tracking.form.full",
  "anime.completed.view",
  "anime.completed.create",
  "anime.completed.update",
  "anime.completed.delete",
  "anime.completed.form.full",
  "anime.rating.write",
  ANIME_CALENDAR_PERMISSION_CODE,
  ANIME_TIER_LIST_ANIMES_PERMISSION_CODE,
  ANIME_TIER_LIST_OPENINGS_PERMISSION_CODE,
  ANIME_TIER_LIST_OPENINGS_MANAGE_PERMISSION_CODE,
  "tracker.view",
  TRACKER_CALENDAR_PERMISSION_CODE,
  "tracker.create",
  "tracker.update",
  "tracker.delete",
  "tracker.export",
  "tracker.import",
  "tracker.lives.notify",
  "tracker.form.full",
  "admin.lives.notify",
  "spacedrum.view",
  "admin.spacedrum.chapters.view",
  "admin.spacedrum.chapters.create",
  "admin.spacedrum.chapters.update",
  "admin.spacedrum.chapters.delete",
  "admin.spacedrum.pages.view",
  "admin.spacedrum.pages.create",
  "admin.spacedrum.pages.update",
  "admin.spacedrum.pages.delete",
  "admin.spacedrum.settings.view",
  "admin.spacedrum.settings.update",
  "admin.spacedrum.import.view",
  "admin.spacedrum.import.run",
];
const MODERATOR_PERMISSION_CODES = [
  "home.view",
  "support.tickets.view",
  "support.tickets.create",
  "rtfm.view",
  "news.view",
  "changelog.view",
  "admin.tickets.view",
  "admin.tickets.update",
  "anime.tracking.view",
  "anime.tracking.update",
  "anime.tracking.form.compact",
  "anime.completed.view",
  "anime.completed.update",
  "anime.completed.form.compact",
  ANIME_CALENDAR_PERMISSION_CODE,
  ANIME_TIER_LIST_ANIMES_PERMISSION_CODE,
  ANIME_TIER_LIST_OPENINGS_PERMISSION_CODE,
  "tracker.view",
  TRACKER_CALENDAR_PERMISSION_CODE,
  "tracker.update",
  "tracker.form.compact",
];

export const DEFAULT_PLATFORM_PERMISSIONS = [
  { code: "home.view", label: "Ver inicio", group: "Plataforma: Inicio", sortOrder: 1 },
  { code: "notifications.view", label: "Ver campana de notificaciones", group: "Plataforma: Notificaciones", sortOrder: 2 },
  { code: "notifications.full.view", label: "Ver todas las notificaciones", group: "Plataforma: Notificaciones", sortOrder: 3 },
  { code: "support.tickets.view", label: "Ver Sugerencias/Reclamos", group: "Plataforma: Sugerencias/Reclamos", sortOrder: 4 },
  { code: "support.tickets.create", label: "Crear sugerencias/reclamos", group: "Plataforma: Sugerencias/Reclamos", sortOrder: 5 },
  { code: "rtfm.view", label: "Ver RTFM", group: "Plataforma: RTFM", sortOrder: 6 },
  { code: "news.view", label: "Ver novedades", group: "Plataforma: Novedades", sortOrder: 7 },
  { code: "changelog.view", label: "Ver historial de cambios", group: "Plataforma: Historial de cambios", sortOrder: 8 },
  { code: "tracker.view", label: "Ver rastreador", group: "Archivo VOD: Rastreador", sortOrder: 10 },
  { code: "tracker.calendar.view", label: "Ver calendario de directos", group: "Archivo VOD: Calendario", sortOrder: 20 },
  { code: "tracker.create", label: "Crear directos", group: "Archivo VOD: Rastreador", sortOrder: 30 },
  { code: "tracker.update", label: "Editar directos", group: "Archivo VOD: Rastreador", sortOrder: 40 },
  { code: "tracker.delete", label: "Eliminar directos", group: "Archivo VOD: Rastreador", sortOrder: 50 },
  { code: "tracker.export", label: "Exportar directos a Excel", group: "Archivo VOD: Rastreador", sortOrder: 52 },
  { code: "tracker.import", label: "Importar actualizaciones desde Excel", group: "Archivo VOD: Rastreador", sortOrder: 54 },
  { code: "tracker.lives.notify", label: "Notificar resubido", group: "Archivo VOD: Rastreador", sortOrder: 55 },
  { code: "tracker.form.full", label: "Formulario completo", group: "Archivo VOD: Rastreador", sortOrder: 60 },
  { code: "tracker.form.compact", label: "Formulario compacto", group: "Archivo VOD: Rastreador", sortOrder: 70 },
  { code: "anime.tracking.view", label: "Ver Viendo", group: "Biblioteca de anime: Viendo", sortOrder: 100 },
  { code: "anime.tracking.create", label: "Crear en Viendo", group: "Biblioteca de anime: Viendo", sortOrder: 110 },
  { code: "anime.tracking.update", label: "Editar Viendo", group: "Biblioteca de anime: Viendo", sortOrder: 120 },
  { code: "anime.tracking.delete", label: "Eliminar de Viendo", group: "Biblioteca de anime: Viendo", sortOrder: 130 },
  { code: "anime.tracking.form.full", label: "Formulario completo", group: "Biblioteca de anime: Viendo", sortOrder: 140 },
  { code: "anime.tracking.form.compact", label: "Formulario compacto", group: "Biblioteca de anime: Viendo", sortOrder: 150 },
  { code: "anime.completed.view", label: "Ver Terminados", group: "Biblioteca de anime: Terminados", sortOrder: 160 },
  { code: "anime.completed.create", label: "Crear en Terminados", group: "Biblioteca de anime: Terminados", sortOrder: 170 },
  { code: "anime.completed.update", label: "Editar Terminados", group: "Biblioteca de anime: Terminados", sortOrder: 180 },
  { code: "anime.completed.delete", label: "Eliminar de Terminados", group: "Biblioteca de anime: Terminados", sortOrder: 190 },
  { code: "anime.completed.form.full", label: "Formulario completo", group: "Biblioteca de anime: Terminados", sortOrder: 200 },
  { code: "anime.completed.form.compact", label: "Formulario compacto", group: "Biblioteca de anime: Terminados", sortOrder: 210 },
  { code: "anime.rating.write", label: "Calificar anime", group: "Biblioteca de anime: Puntuación", sortOrder: 220 },
  { code: "anime.rating.streamer", label: "Mostrar nota destacada", group: "Biblioteca de anime: Puntuación", sortOrder: 230 },
  { code: "anime.calendar.view", label: "Ver Calendario de temporada", group: "Biblioteca de anime: Calendario de temporada", sortOrder: 90 },
  { code: "anime.tierlist.animes.view", label: "Ver Tier List de Animes", group: "Biblioteca de anime: Tier List", sortOrder: 92 },
  { code: "anime.tierlist.openings.view", label: "Ver Tier List de Openings/Endings", group: "Biblioteca de anime: Tier List", sortOrder: 94 },
  { code: "anime.tierlist.openings.manage", label: "Crear y editar Openings/Endings desde el tablero", group: "Biblioteca de anime: Tier List", sortOrder: 95 },
  { code: "spacedrum.view", label: "Ver SpaceDrum", group: "Lecturas: SpaceDrum", sortOrder: 300 },
  { code: "users.read", label: "Ver usuarios", group: "Administración: Usuarios", sortOrder: 400 },
  { code: "users.create", label: "Crear usuarios", group: "Administración: Usuarios", sortOrder: 410 },
  { code: "users.update", label: "Editar usuarios", group: "Administración: Usuarios", sortOrder: 420 },
  { code: "users.delete", label: "Eliminar usuarios", group: "Administración: Usuarios", sortOrder: 430 },
  { code: "roles.read", label: "Ver roles", group: "Administración: Roles", sortOrder: 440 },
  { code: "roles.create", label: "Crear roles", group: "Administración: Roles", sortOrder: 450 },
  { code: "roles.update", label: "Editar roles", group: "Administración: Roles", sortOrder: 460 },
  { code: "admin.notifications.view", label: "Ver mantenedor Notificaciones", group: "Administración: Notificaciones", sortOrder: 462 },
  { code: "admin.notifications.create", label: "Crear notificaciones", group: "Administración: Notificaciones", sortOrder: 464 },
  { code: "admin.notifications.update", label: "Editar notificaciones", group: "Administración: Notificaciones", sortOrder: 466 },
  { code: "admin.notifications.delete", label: "Eliminar notificaciones", group: "Administración: Notificaciones", sortOrder: 468 },
  { code: "admin.tickets.view", label: "Ver tickets", group: "Administración: Tickets", sortOrder: 470 },
  { code: "admin.tickets.update", label: "Responder tickets", group: "Administración: Tickets", sortOrder: 472 },
  { code: "admin.tracker.view", label: "Ver mantenedor Rastreador", group: "Administración: Rastreador", sortOrder: 480 },
  { code: "admin.lives.notify", label: "Notificar resubido", group: "Administración: Rastreador", sortOrder: 485 },
  { code: "admin.tags.view", label: "Ver mantenedor Tags", group: "Administración: Tags", sortOrder: 490 },
  { code: "tags.create", label: "Crear categorias de tags", group: "Administración: Tags", sortOrder: 500 },
  { code: "tags.update", label: "Editar tags", group: "Administración: Tags", sortOrder: 510 },
  { code: "tags.delete", label: "Eliminar tags", group: "Administración: Tags", sortOrder: 520 },
  { code: "admin.anime.tracking.view", label: "Ver mantenedor Viendo", group: "Administración: Anime Viendo", sortOrder: 530 },
  { code: "admin.anime.completed.view", label: "Ver mantenedor Terminados", group: "Administración: Anime Terminados", sortOrder: 540 },
  { code: "admin.anime.calendar.view", label: "Ver Calendario de temporada", group: "Administración: Calendario de temporada", sortOrder: 525 },
  { code: "admin.anime.calendar.sync", label: "Sincronizar temporadas", group: "Administración: Calendario de temporada", sortOrder: 526 },
  { code: "admin.anime.calendar.update", label: "Editar calendario", group: "Administración: Calendario de temporada", sortOrder: 527 },
  { code: "admin.anime.tierlist.animes.view", label: "Ver mantenedor Tier List de Animes", group: "Administración: Tier List de Animes", sortOrder: 670 },
  { code: "admin.anime.tierlist.animes.sync", label: "Sincronizar Tier List de Animes", group: "Administración: Tier List de Animes", sortOrder: 671 },
  { code: "admin.anime.tierlist.animes.create", label: "Crear en Tier List de Animes", group: "Administración: Tier List de Animes", sortOrder: 672 },
  { code: "admin.anime.tierlist.animes.update", label: "Editar Tier List de Animes", group: "Administración: Tier List de Animes", sortOrder: 673 },
  { code: "admin.anime.tierlist.animes.delete", label: "Eliminar de Tier List de Animes", group: "Administración: Tier List de Animes", sortOrder: 674 },
  { code: "admin.anime.tierlist.openings.view", label: "Ver mantenedor Openings/Endings", group: "Administración: Tier List de Openings/Endings", sortOrder: 680 },
  { code: "admin.anime.tierlist.openings.sync", label: "Sincronizar Openings/Endings", group: "Administración: Tier List de Openings/Endings", sortOrder: 681 },
  { code: "admin.anime.tierlist.openings.create", label: "Crear Openings/Endings", group: "Administración: Tier List de Openings/Endings", sortOrder: 682 },
  { code: "admin.anime.tierlist.openings.update", label: "Editar Openings/Endings", group: "Administración: Tier List de Openings/Endings", sortOrder: 683 },
  { code: "admin.anime.tierlist.openings.delete", label: "Eliminar Openings/Endings", group: "Administración: Tier List de Openings/Endings", sortOrder: 684 },
  { code: "admin.spacedrum.chapters.view", label: "Ver capítulos", group: "Administración: SpaceDrum", sortOrder: 550 },
  { code: "admin.spacedrum.chapters.create", label: "Crear capítulos", group: "Administración: SpaceDrum", sortOrder: 560 },
  { code: "admin.spacedrum.chapters.update", label: "Editar capítulos", group: "Administración: SpaceDrum", sortOrder: 570 },
  { code: "admin.spacedrum.chapters.delete", label: "Eliminar capítulos", group: "Administración: SpaceDrum", sortOrder: 580 },
  { code: "admin.spacedrum.pages.view", label: "Ver páginas", group: "Administración: SpaceDrum", sortOrder: 590 },
  { code: "admin.spacedrum.pages.create", label: "Crear páginas", group: "Administración: SpaceDrum", sortOrder: 600 },
  { code: "admin.spacedrum.pages.update", label: "Editar páginas", group: "Administración: SpaceDrum", sortOrder: 610 },
  { code: "admin.spacedrum.pages.delete", label: "Eliminar páginas", group: "Administración: SpaceDrum", sortOrder: 620 },
  { code: "admin.spacedrum.settings.view", label: "Ver configuración", group: "Administración: SpaceDrum", sortOrder: 630 },
  { code: "admin.spacedrum.settings.update", label: "Editar configuración", group: "Administración: SpaceDrum", sortOrder: 640 },
  { code: "admin.spacedrum.import.view", label: "Ver importación", group: "Administración: SpaceDrum", sortOrder: 650 },
  { code: "admin.spacedrum.import.run", label: "Ejecutar importación", group: "Administración: SpaceDrum", sortOrder: 660 },
];

export const DEFAULT_PLATFORM_ROLES = [
  { code: "dios", label: "Dios", sortOrder: 10, canAdmin: true },
  { code: "admin", label: "Admin", sortOrder: 20, canAdmin: true },
  { code: "moderador", label: "Moderador", sortOrder: 30, canAdmin: true },
  { code: "tw-tier-1", label: "TW_Tier 1", sortOrder: 40, canAdmin: false },
  { code: "tw-tier-2", label: "TW_Tier 2", sortOrder: 50, canAdmin: false },
  { code: "tw-tier-3", label: "TW_Tier 3", sortOrder: 60, canAdmin: false },
  { code: "tw-vip", label: "TW_VIP", sortOrder: 70, canAdmin: false },
  { code: "yt-miembro", label: "YT_Miembro", sortOrder: 80, canAdmin: false },
  { code: "publico", label: "Público", sortOrder: 90, canAdmin: false },
  { code: "invitado", label: "Invitado", sortOrder: 100, canAdmin: false },
];

function normalizeRoleCode(roleCode) {
  const value = String(roleCode || "").trim().toLowerCase();
  return LEGACY_ROLE_MAP[value] || value || DEFAULT_ROLE_CODE;
}

function buildManualLogin() {
  return `manual-${crypto.randomUUID()}`;
}

function normalizeLogin(login) {
  return String(login || "").trim().toLowerCase();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, PASSWORD_KEY_LENGTH).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) {
    return false;
  }

  const { hash } = hashPassword(password, salt);
  const hashBuffer = Buffer.from(hash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (hashBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, expectedBuffer);
}

function validateAlias(alias) {
  if (!alias) {
    throw new Error("El alias es obligatorio.");
  }

  if (alias.length < 2) {
    throw new Error("El alias debe tener al menos 2 caracteres.");
  }

  if (alias.length > 40) {
    throw new Error("El alias no puede superar 40 caracteres.");
  }

  if (!ALIAS_PATTERN.test(alias)) {
    throw new Error("Usa letras, números, espacios, punto, guion o guion bajo.");
  }
}

function validateEmail(email) {
  if (!email) {
    throw new Error("El email es obligatorio.");
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    throw new Error("El email no puede superar 254 caracteres.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Ingresa un email válido.");
  }
}

function validatePassword(password) {
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  if (password.length > 72) {
    throw new Error("La contraseña no puede superar 72 caracteres.");
  }

  if (!/\p{L}/u.test(password)) {
    throw new Error("La contraseña debe incluir al menos una letra.");
  }

  if (!/\p{N}/u.test(password)) {
    throw new Error("La contraseña debe incluir al menos un número.");
  }
}

function isCustomAvatarUrl(avatarUrl) {
  return String(avatarUrl || "").startsWith("/imagenes/avatars/");
}

function compactRole(role) {
  if (!role) {
    return null;
  }

  const permissions = (role.permissions || [])
    .map((item) => item.permission)
    .filter(Boolean)
    .map((permission) => permission.code);

  return {
    id: role.id,
    code: role.code,
    label: role.label,
    sortOrder: role.sortOrder,
    isActive: role.isActive,
    canAdmin: role.canAdmin,
    permissions: role.code === GOD_ROLE_CODE
      ? DEFAULT_PLATFORM_PERMISSIONS
        .map((permission) => permission.code)
        .filter((permissionCode) => !GOD_EXCLUDED_PERMISSION_CODES.has(permissionCode))
      : permissions,
  };
}

function compactUser(user) {
  const role = compactRole(user.role);

  return {
    id: user.id,
    twitchUserId: user.twitchUserId,
    login: user.login,
    alias: user.alias,
    email: user.email,
    avatarUrl: user.avatarUrl,
    twitchSubscriberTier: user.twitchSubscriberTier,
    isTwitchModerator: user.isTwitchModerator,
    isTwitchVip: user.isTwitchVip,
    twitchRoleSyncedAt: user.twitchRoleSyncedAt?.toISOString() || null,
    hasPassword: Boolean(user.passwordHash && user.passwordSalt),
    authIdentities: (user.authIdentities || []).map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      email: identity.providerEmail,
      emailVerified: identity.emailVerified,
      login: identity.providerLogin,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      linkedAt: identity.linkedAt?.toISOString() || null,
      lastUsedAt: identity.lastUsedAt?.toISOString() || null,
    })),
    role: role?.code || null,
    roleLabel: role?.label || null,
    roleCanAdmin: role?.canAdmin || false,
    permissions: role?.permissions || [],
    roleId: user.roleId,
    roleSource: user.roleSource,
    isActive: user.isActive,
    deletedAt: user.deletedAt?.toISOString() || null,
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    createdAt: user.createdAt?.toISOString() || null,
    updatedAt: user.updatedAt?.toISOString() || null,
  };
}

function getSessionExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  return expiresAt;
}

export function userCanAdmin(user) {
  return Boolean(user?.isActive && (user.roleCanAdmin || user.role?.canAdmin || can(user, "tracker.update")));
}

export function userCanManagePlatformUsers(user) {
  return can(user, "users.read");
}

export function userCanManagePlatformRoles(user) {
  return can(user, "roles.read");
}

export function can(user, permissionCode) {
  if (!user?.isActive) {
    return false;
  }

  if (user.role === GOD_ROLE_CODE || user.role?.code === GOD_ROLE_CODE) {
    if (GOD_EXCLUDED_PERMISSION_CODES.has(permissionCode)) {
      return false;
    }

    return true;
  }

  const permissions = user.permissions || user.role?.permissions || [];
  return permissions.includes(permissionCode);
}

export function canAny(user, permissionCodes = []) {
  return permissionCodes.some((permissionCode) => can(user, permissionCode));
}

function userIsGod(user) {
  return user?.role === BOOTSTRAP_ROLE_CODE || user?.role?.code === BOOTSTRAP_ROLE_CODE;
}

function resolveAutomaticTwitchRole(membership) {
  if (membership?.isModerator) {
    return "moderador";
  }

  if (membership?.isVip) {
    return "tw-vip";
  }

  if (membership?.subscriberTier === "3000") {
    return "tw-tier-3";
  }

  if (membership?.subscriberTier === "2000") {
    return "tw-tier-2";
  }

  if (membership?.subscriberTier === "1000") {
    return "tw-tier-1";
  }

  return DEFAULT_ROLE_CODE;
}

export async function ensurePlatformRoles(prisma = getPrismaClient()) {
  const existingRoles = await prisma.platformRole.findMany({
    where: { code: { in: DEFAULT_PLATFORM_ROLES.map((role) => role.code) } },
    select: { code: true },
  });
  const existingRoleCodes = new Set(existingRoles.map((role) => role.code));

  for (const role of DEFAULT_PLATFORM_ROLES) {
    if (existingRoleCodes.has(role.code)) {
      await prisma.platformRole.update({
        where: { code: role.code },
        data: {
          label: role.label,
          sortOrder: role.sortOrder,
          canAdmin: role.canAdmin,
        },
      });
      continue;
    }

    await prisma.platformRole.create({
      data: {
        code: role.code,
        label: role.label,
        sortOrder: role.sortOrder,
        isActive: true,
        canAdmin: role.canAdmin,
      },
    });
  }
}

export async function ensurePlatformPermissions(prisma = getPrismaClient()) {
  await ensurePlatformRoles(prisma);

  for (const permission of DEFAULT_PLATFORM_PERMISSIONS) {
    await prisma.platformPermission.upsert({
      where: { code: permission.code },
      update: {
        label: permission.label,
        group: permission.group,
        sortOrder: permission.sortOrder,
        isActive: true,
      },
      create: {
        code: permission.code,
        label: permission.label,
        group: permission.group,
        sortOrder: permission.sortOrder,
        isActive: true,
      },
    });
  }

  await assignDefaultPermissions(prisma, "admin", ADMIN_PERMISSION_CODES);
  await assignDefaultPermissions(prisma, "moderador", MODERATOR_PERMISSION_CODES);
  for (const roleCode of TRACKER_CALENDAR_DEFAULT_ROLE_CODES) {
    await assignDefaultPermissions(prisma, roleCode, [TRACKER_CALENDAR_PERMISSION_CODE]);
  }
  for (const roleCode of ANIME_CALENDAR_DEFAULT_ROLE_CODES) {
    await assignDefaultPermissions(prisma, roleCode, [ANIME_CALENDAR_PERMISSION_CODE]);
  }
  for (const roleCode of ANIME_CALENDAR_DEFAULT_ROLE_CODES) {
    await assignDefaultPermissions(prisma, roleCode, [
      ANIME_TIER_LIST_ANIMES_PERMISSION_CODE,
      ANIME_TIER_LIST_OPENINGS_PERMISSION_CODE,
    ]);
  }
  for (const role of DEFAULT_PLATFORM_ROLES) {
    await assignDefaultPermissions(prisma, role.code, ["rtfm.view", "news.view", "changelog.view"]);
  }
  for (const roleCode of SUPPORT_TICKET_DEFAULT_ROLE_CODES) {
    await assignDefaultPermissions(prisma, roleCode, ["support.tickets.view", "support.tickets.create"]);
  }
  for (const roleCode of ANIME_TIER_LIST_OPENINGS_MANAGE_DEFAULT_ROLE_CODES) {
    await assignDefaultPermissions(prisma, roleCode, [ANIME_TIER_LIST_OPENINGS_MANAGE_PERMISSION_CODE]);
  }
  await assignDefaultPermissions(prisma, GUEST_ROLE_CODE, [
    "notifications.view",
    ANIME_TIER_LIST_ANIMES_PERMISSION_CODE,
    ANIME_TIER_LIST_OPENINGS_PERMISSION_CODE,
  ]);
  await ensureExclusiveStreamerRatingPermission(prisma);
}

export async function getPublicAccessUser() {
  const prisma = getPrismaClient();
  await ensurePlatformPermissions(prisma);

  const role = await prisma.platformRole.findUnique({
    where: { code: GUEST_ROLE_CODE },
    include: ROLE_INCLUDE,
  });

  if (!role?.isActive) {
    return null;
  }

  return {
    id: null,
    login: "invitado",
    alias: "Invitado",
    role: GUEST_ROLE_CODE,
    roleLabel: role.label,
    roleCanAdmin: false,
    permissions: compactRole(role)?.permissions || [],
    isActive: true,
    isPublic: true,
  };
}

async function assignDefaultPermissions(prisma, roleCode, permissionCodes) {
  const role = await prisma.platformRole.findUnique({ where: { code: roleCode } });

  if (!role) {
    return;
  }

  const permissions = await prisma.platformPermission.findMany({
    where: { code: { in: permissionCodes } },
    select: { id: true },
  });

  for (const permission of permissions) {
    try {
      await prisma.platformRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    } catch (error) {
      // Ejecuciones concurrentes de este self-heal pueden pisarse en la misma clave;
      // si ya existe, el resultado deseado ya está dado.
      if (error?.code !== "P2002") throw error;
    }
  }
}

async function ensureExclusiveStreamerRatingPermission(prisma) {
  const [permission, writePermission] = await Promise.all([
    prisma.platformPermission.findUnique({
      where: { code: STREAMER_RATING_PERMISSION_CODE },
      select: { id: true },
    }),
    prisma.platformPermission.findUnique({
      where: { code: RATING_WRITE_PERMISSION_CODE },
      select: { id: true },
    }),
  ]);

  if (!permission) {
    return;
  }

  const assignments = await prisma.platformRolePermission.findMany({
    where: { permissionId: permission.id },
    include: { role: { select: { id: true, code: true, sortOrder: true } } },
  });

  if (!assignments.length) {
    return;
  }

  const validAssignments = assignments
    .filter((assignment) => assignment.role?.code !== GOD_ROLE_CODE)
    .sort((left, right) => (left.role?.sortOrder || 999) - (right.role?.sortOrder || 999));
  const assignmentToKeep = validAssignments[0] || null;

  if (assignmentToKeep && writePermission) {
    try {
      await prisma.platformRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: assignmentToKeep.roleId,
            permissionId: writePermission.id,
          },
        },
        update: {},
        create: {
          roleId: assignmentToKeep.roleId,
          permissionId: writePermission.id,
        },
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
    }
  }

  await prisma.platformRolePermission.deleteMany({
    where: {
      permissionId: permission.id,
      OR: [
        { role: { code: GOD_ROLE_CODE } },
        ...(assignmentToKeep ? [{ roleId: { not: assignmentToKeep.roleId } }] : []),
      ],
    },
  });
}

export async function listPlatformRoles({ includeInactive = false } = {}) {
  const prisma = getPrismaClient();
  await ensurePlatformPermissions(prisma);

  const roles = await prisma.platformRole.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [
      { sortOrder: "asc" },
      { label: "asc" },
      { id: "asc" },
    ],
    include: { permissions: { include: { permission: true } } },
  });

  return roles.map(compactRole);
}

export async function listPlatformPermissions() {
  const prisma = getPrismaClient();
  await ensurePlatformPermissions(prisma);

  return prisma.platformPermission.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: "asc" },
      { label: "asc" },
    ],
  });
}

export async function upsertPlatformRole(input, { actor = null } = {}) {
  if (!can(actor, "roles.update") && !can(actor, "roles.create")) {
    throw new Error("No autorizado para administrar roles.");
  }

  const prisma = getPrismaClient();
  await ensurePlatformPermissions(prisma);

  const id = Number(input?.id);
  const code = normalizeRoleCode(input?.code);
  const label = String(input?.label || "").trim();
  const isCreating = !id;
  const permissionCodes = Array.from(new Set(Array.isArray(input?.permissions) ? input.permissions : []));
  if (permissionCodes.includes(STREAMER_RATING_PERMISSION_CODE) && !permissionCodes.includes(RATING_WRITE_PERMISSION_CODE)) {
    permissionCodes.push(RATING_WRITE_PERMISSION_CODE);
  }
  const hasStreamerRatingPermission = permissionCodes.includes(STREAMER_RATING_PERMISSION_CODE);

  if (!/^[a-z0-9._-]{3,40}$/.test(code)) {
    throw new Error("El código del rol debe tener 3 a 40 caracteres: letras, números, punto, guion o guion bajo.");
  }

  if (!label) {
    throw new Error("El nombre del rol es obligatorio.");
  }

  const existingRole = id
    ? await prisma.platformRole.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } })
    : null;
  const existingRoleIsProtected = PROTECTED_ROLE_CODES.has(existingRole?.code);
  const targetIsGod = existingRole?.code === GOD_ROLE_CODE || code === GOD_ROLE_CODE;

  if (targetIsGod) {
    throw new Error("El rol Dios es inmutable.");
  }

  if (existingRoleIsProtected && input?.isActive === false) {
    throw new Error("El rol Invitado no se puede desactivar.");
  }

  if (isCreating && !can(actor, "roles.create")) {
    throw new Error("No autorizado para crear roles.");
  }

  if (!isCreating && !can(actor, "roles.update")) {
    throw new Error("No autorizado para editar roles.");
  }

  const duplicate = await prisma.platformRole.findFirst({
    where: {
      code,
      ...(id ? { id: { not: id } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("Ese código de rol ya existe.");
  }

  const role = id
    ? await prisma.platformRole.update({
        where: { id },
        data: {
          code,
          label,
          sortOrder: existingRole?.sortOrder || 100,
          isActive: existingRoleIsProtected ? true : input?.isActive === false ? false : true,
          canAdmin: permissionCodes.some((permission) => permission.startsWith("users.") || permission.startsWith("roles.")),
        },
      })
    : await prisma.platformRole.create({
        data: {
          code,
          label,
          sortOrder: 100,
          isActive: input?.isActive === false ? false : true,
          canAdmin: permissionCodes.some((permission) => permission.startsWith("users.") || permission.startsWith("roles.")),
        },
      });

  const permissions = await prisma.platformPermission.findMany({
    where: { code: { in: permissionCodes }, isActive: true },
    select: { id: true, code: true },
  });

  await prisma.platformRolePermission.deleteMany({ where: { roleId: role.id } });

  if (hasStreamerRatingPermission) {
    const streamerRatingPermission = permissions.find((permission) => permission.code === STREAMER_RATING_PERMISSION_CODE)
      || await prisma.platformPermission.findUnique({
        where: { code: STREAMER_RATING_PERMISSION_CODE },
        select: { id: true },
      });

    if (streamerRatingPermission) {
      await prisma.platformRolePermission.deleteMany({
        where: {
          permissionId: streamerRatingPermission.id,
          roleId: { not: role.id },
        },
      });
    }
  }

  if (permissions.length) {
    await prisma.platformRolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  const savedRole = await prisma.platformRole.findUnique({
    where: { id: role.id },
    include: { permissions: { include: { permission: true } } },
  });

  return compactRole(savedRole);
}

export async function updatePlatformRoleStatus(id, isActive, { actor = null } = {}) {
  if (!can(actor, "roles.update")) {
    throw new Error("No autorizado para editar roles.");
  }

  const prisma = getPrismaClient();
  const role = await prisma.platformRole.findUnique({
    where: { id: Number(id) },
    include: { permissions: { include: { permission: true } } },
  });

  if (!role) {
    throw new Error("El rol no existe.");
  }

  if (role.code === GOD_ROLE_CODE) {
    throw new Error("El rol Dios es inmutable.");
  }

  if (role.code === GUEST_ROLE_CODE) {
    throw new Error("El rol Invitado no puede cambiar de estado.");
  }

  await prisma.platformRole.update({
    where: { id: Number(id) },
    data: { isActive: Boolean(isActive) },
  });
}

async function resolveRole(prisma, roleCode) {
  await ensurePlatformRoles(prisma);

  const normalizedCode = normalizeRoleCode(roleCode);
  const role = await prisma.platformRole.findFirst({
    where: {
      code: normalizedCode,
      isActive: true,
    },
  });

  if (role) {
    return role;
  }

  const fallbackRole = await prisma.platformRole.findUnique({
    where: { code: DEFAULT_ROLE_CODE },
  });

  if (!fallbackRole) {
    throw new Error("No existe un rol por defecto para usuarios.");
  }

  return fallbackRole;
}

export async function listPlatformUsers() {
  const prisma = getPrismaClient();
  await ensurePlatformRoles(prisma);

  const users = await prisma.platformUser.findMany({
    where: { deletedAt: null },
    orderBy: [
      { isActive: "desc" },
      { role: { sortOrder: "asc" } },
      { login: "asc" },
    ],
    include: USER_INCLUDE,
  });

  return users.map(compactUser);
}

export async function upsertPlatformUser(input, { actor = null } = {}) {
  const prisma = getPrismaClient();
  const id = Number(input?.id);
  const providedLogin = normalizeLogin(input?.login);
  const alias = String(input?.alias || "").trim();
  const email = normalizeEmail(input?.email);
  const password = String(input?.password || "");
  const confirmPassword = String(input?.confirmPassword || "");
  const twitchUserId = String(input?.twitchUserId || "").trim() || null;

  validateAlias(alias);
  validateEmail(email);

  const role = await resolveRole(prisma, input?.role || input?.roleCode);
  const existingUser = id
    ? await prisma.platformUser.findUnique({
        where: { id },
        include: USER_INCLUDE,
      })
    : null;

  if (id && !existingUser) {
    throw new Error("El usuario no existe.");
  }

  if (existingUser?.deletedAt) {
    throw new Error("El usuario está archivado y no se puede modificar.");
  }

  const login = providedLogin || existingUser?.login || buildManualLogin();
  const isCreating = !id;
  const actorIsGod = userIsGod(actor);
  const existingUserIsGod = existingUser?.role?.code === BOOTSTRAP_ROLE_CODE;
  const nextUserIsGod = role.code === BOOTSTRAP_ROLE_CODE;

  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    throw new Error("El usuario debe tener 3 a 32 caracteres: letras, números, punto, guion o guion bajo.");
  }

  if (isCreating || password || confirmPassword) {
    validatePassword(password);

    if (password !== confirmPassword) {
      throw new Error("Las contraseñas no coinciden.");
    }
  }

  if (existingUserIsGod && !actorIsGod) {
    throw new Error("Solo Dios puede editar al usuario Dios.");
  }

  if (existingUserIsGod && (password || confirmPassword)) {
    throw new Error("La contraseña del usuario Dios no se puede cambiar.");
  }

  if (existingUserIsGod && input?.isActive === false) {
    throw new Error("El usuario Dios no puede cambiar de estado.");
  }

  if (existingUserIsGod && role.id !== existingUser.roleId) {
    throw new Error("El usuario Dios no puede cambiar de rol.");
  }

  if (existingUserIsGod && !nextUserIsGod) {
    throw new Error("El usuario Dios no puede dejar de tener el rol Dios.");
  }

  if (nextUserIsGod && !actorIsGod) {
    throw new Error("Solo Dios puede asignar el rol Dios.");
  }

  if (nextUserIsGod) {
    const existingGod = await prisma.platformUser.findFirst({
      where: {
        role: { code: BOOTSTRAP_ROLE_CODE },
        deletedAt: null,
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });

    if (existingGod) {
      throw new Error("Ya existe un usuario Dios. Dios hay uno solo.");
    }
  }

  const existingIdentifierUser = await prisma.platformUser.findFirst({
    where: {
      OR: [
        { login },
        { email },
      ],
      ...(id ? { id: { not: id } } : {}),
    },
    select: { id: true, login: true, email: true },
  });

  if (existingIdentifierUser?.login === login) {
    throw new Error("Ese usuario ya existe.");
  }

  if (existingIdentifierUser?.email === email) {
    throw new Error("Ese email ya está registrado.");
  }

  const credentials = password ? hashPassword(password) : null;
  const data = {
    twitchUserId,
    login,
    alias,
    email,
    avatarUrl: String(input?.avatarUrl || "").trim() || null,
    roleId: role.id,
    roleSource: "manual",
    isActive: input?.isActive === false ? false : true,
    ...(credentials
      ? {
          passwordHash: credentials.hash,
          passwordSalt: credentials.salt,
          passwordUpdatedAt: new Date(),
        }
      : {}),
  };

  const user = id
    ? await prisma.platformUser.update({
        where: { id },
        data,
        include: USER_INCLUDE,
      })
    : await prisma.platformUser.create({ data, include: USER_INCLUDE });

  return compactUser(user);
}

export async function registerManualUser(input) {
  const prisma = getPrismaClient();
  const login = normalizeLogin(input?.login);
  const alias = String(input?.alias || "").trim();
  const email = normalizeEmail(input?.email);
  const password = String(input?.password || "");

  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    throw new Error("El usuario debe tener 3 a 32 caracteres: letras, números, punto, guion o guion bajo.");
  }

  validateAlias(alias);
  validateEmail(email);

  validatePassword(password);

  await ensurePlatformRoles(prisma);
  const existing = await prisma.platformUser.findFirst({
    where: {
      OR: [
        { login },
        { email },
      ],
    },
    select: { id: true, login: true, email: true },
  });

  if (existing?.login === login) {
    throw new Error("Ese usuario ya existe.");
  }

  if (existing?.email === email) {
    throw new Error("Ese email ya está registrado.");
  }

  const role = await resolveRole(prisma, DEFAULT_ROLE_CODE);
  const credentials = hashPassword(password);
  const user = await prisma.platformUser.create({
    data: {
      login,
      alias,
      email,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      passwordUpdatedAt: new Date(),
      roleId: role.id,
      isActive: true,
    },
    include: USER_INCLUDE,
  });

  return compactUser(user);
}

export async function authenticateManualUser({ login, password }) {
  const prisma = getPrismaClient();
  const user = await prisma.platformUser.findUnique({
    where: { login: normalizeLogin(login) },
    include: USER_INCLUDE,
  });

  if (!user || user.deletedAt || !user.isActive || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  return compactUser(user);
}

export async function updatePlatformUserStatus(id, isActive) {
  const prisma = getPrismaClient();
  const user = await prisma.platformUser.findUnique({
    where: { id: Number(id) },
    include: USER_INCLUDE,
  });

  if (!user || user.deletedAt) {
    throw new Error("El usuario no existe.");
  }

  if (user.role?.code === BOOTSTRAP_ROLE_CODE) {
    throw new Error("El usuario Dios no puede cambiar de estado.");
  }

  if (user.role?.code === GUEST_ROLE_CODE) {
    throw new Error("El usuario Invitado no se puede activar ni desactivar.");
  }

  await prisma.platformUser.update({
    where: { id: Number(id) },
    data: { isActive: Boolean(isActive) },
  });
}

export async function deletePlatformUser(id) {
  const prisma = getPrismaClient();
  const user = await prisma.platformUser.findUnique({
    where: { id: Number(id) },
    include: USER_INCLUDE,
  });

  if (!user || user.deletedAt) {
    throw new Error("El usuario no existe.");
  }

  if (user?.role?.code === BOOTSTRAP_ROLE_CODE) {
    throw new Error("El usuario Dios no se puede eliminar.");
  }

  if (user?.role?.code === GUEST_ROLE_CODE) {
    throw new Error("El usuario Invitado no se puede eliminar.");
  }

  await prisma.platformUser.update({
    where: { id: Number(id) },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  await prisma.platformSession.deleteMany({ where: { userId: Number(id) } });
}

export async function updateCurrentUserProfile(input, { user = null } = {}) {
  if (!user?.id) {
    throw new Error("No autorizado.");
  }

  const prisma = getPrismaClient();
  const alias = String(input?.alias || "").trim();
  const email = normalizeEmail(input?.email);
  const avatarUrl = String(input?.avatarUrl || "").trim() || null;

  validateAlias(alias);
  validateEmail(email);

  const duplicate = await prisma.platformUser.findFirst({
    where: {
      email,
      id: { not: Number(user.id) },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("Ese email ya está registrado.");
  }

  const existingUser = await prisma.platformUser.findUnique({
    where: { id: Number(user.id) },
    select: { id: true, deletedAt: true },
  });

  if (!existingUser || existingUser.deletedAt) {
    throw new Error("No autorizado.");
  }

  const savedUser = await prisma.platformUser.update({
    where: { id: Number(user.id) },
    data: {
      alias,
      email,
      avatarUrl,
    },
    include: USER_INCLUDE,
  });

  return compactUser(savedUser);
}

export async function updateCurrentUserPassword(input, { user = null } = {}) {
  if (!user?.id) {
    throw new Error("No autorizado.");
  }

  const prisma = getPrismaClient();
  const currentPassword = String(input?.currentPassword || "");
  const password = String(input?.password || "");
  const confirmPassword = String(input?.confirmPassword || "");
  const existingUser = await prisma.platformUser.findUnique({
    where: { id: Number(user.id) },
    include: USER_INCLUDE,
  });

  if (!existingUser || existingUser.deletedAt) {
    throw new Error("No autorizado.");
  }

  const hasExistingPassword = Boolean(existingUser.passwordHash && existingUser.passwordSalt);

  if (hasExistingPassword) {
    if (user.role === BOOTSTRAP_ROLE_CODE) {
      throw new Error("La contraseña del usuario Dios no se puede cambiar.");
    }

    if (!verifyPassword(currentPassword, existingUser.passwordSalt, existingUser.passwordHash)) {
      throw new Error("La contraseña actual no coincide.");
    }

    if (verifyPassword(password, existingUser.passwordSalt, existingUser.passwordHash)) {
      throw new Error("La nueva contraseña debe ser distinta a la actual.");
    }
  }

  validatePassword(password);

  if (password !== confirmPassword) {
    throw new Error("Las contraseñas no coinciden.");
  }

  const credentials = hashPassword(password);
  const savedUser = await prisma.platformUser.update({
    where: { id: Number(user.id) },
    data: {
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      passwordUpdatedAt: new Date(),
    },
    include: USER_INCLUDE,
  });

  return compactUser(savedUser);
}

function normalizeOAuthProfile(profile) {
  const provider = String(profile?.provider || "").trim().toLowerCase();
  const providerSubject = String(profile?.providerSubject || profile?.id || "").trim();
  const providerEmail = normalizeEmail(profile?.providerEmail || profile?.email) || null;

  if (!provider || !providerSubject) {
    throw new Error("El proveedor no entregó una identidad válida.");
  }

  if (providerEmail) {
    validateEmail(providerEmail);
  }

  return {
    provider,
    providerSubject,
    providerEmail,
    emailVerified: Boolean(profile?.emailVerified),
    providerLogin: String(profile?.providerLogin || profile?.login || "").trim() || null,
    displayName: String(profile?.displayName || profile?.alias || profile?.login || "").trim() || null,
    avatarUrl: String(profile?.avatarUrl || "").trim() || null,
    metadata: profile?.metadata || null,
  };
}

async function buildAvailableLogin(prisma, profile) {
  const rawBase = String(profile.providerLogin || profile.providerEmail?.split("@")[0] || `${profile.provider}-user`)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 24);
  const base = rawBase.length >= 3 ? rawBase : `${profile.provider}-user`;
  let candidate = base;

  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const exists = await prisma.platformUser.findUnique({ where: { login: candidate }, select: { id: true } });
    if (!exists) return candidate;
    candidate = `${base.slice(0, 27)}-${suffix}`;
  }

  return `${profile.provider}-${crypto.randomBytes(5).toString("hex")}`;
}

function buildOAuthAlias(profile, fallback) {
  const alias = String(profile.displayName || "")
    .replace(/[^\p{L}\p{N} _.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return alias.length >= 2 ? alias : fallback;
}

function serializeOAuthRegistrationAttempt(attempt, login) {
  const profile = normalizeOAuthProfile(attempt);
  const suggestedLogin = String(login || profile.providerLogin || profile.providerEmail?.split("@")[0] || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 32);

  return {
    provider: profile.provider,
    login: suggestedLogin,
    alias: buildOAuthAlias(profile, suggestedLogin || `${profile.provider}-user`),
    email: profile.providerEmail,
    avatarUrl: profile.avatarUrl,
    displayName: profile.displayName,
  };
}

function resolveLinkLoginMethods(user, pendingProvider) {
  const methods = [];

  if (user.passwordHash && user.passwordSalt) {
    methods.push("manual");
  }

  const providers = new Set((user.authIdentities || []).map((identity) => identity.provider).filter(Boolean));
  providers.delete(pendingProvider);

  if (providers.has("twitch")) methods.push("twitch");
  if (providers.has("google")) methods.push("google");

  return methods.length ? methods : ["manual"];
}

async function updateTwitchMembership(prisma, user, profile) {
  if (profile.provider !== "twitch") return user;

  const membership = profile.metadata?.twitchMembership || null;
  const automaticRoleCode = resolveAutomaticTwitchRole(membership);
  const shouldSyncRole = user.roleSource === "twitch" || user.role?.code === DEFAULT_ROLE_CODE;
  const nextRole = shouldSyncRole ? await resolveRole(prisma, automaticRoleCode) : user.role;

  return prisma.platformUser.update({
    where: { id: user.id },
    data: {
      twitchUserId: profile.providerSubject,
      twitchSubscriberTier: membership?.subscriberTier || null,
      isTwitchModerator: Boolean(membership?.isModerator),
      isTwitchVip: Boolean(membership?.isVip),
      twitchRoleSyncedAt: membership ? new Date() : null,
      roleId: nextRole.id,
      ...(shouldSyncRole ? { roleSource: "twitch" } : {}),
      avatarUrl: isCustomAvatarUrl(user.avatarUrl) ? user.avatarUrl : profile.avatarUrl || user.avatarUrl,
    },
    include: USER_INCLUDE,
  });
}

export async function resolveOAuthIdentity(input) {
  const prisma = getPrismaClient();
  await ensurePlatformRoles(prisma);
  const profile = normalizeOAuthProfile(input);
  const identity = await prisma.platformAuthIdentity.findUnique({
    where: { provider_providerSubject: { provider: profile.provider, providerSubject: profile.providerSubject } },
    include: { user: { include: USER_INCLUDE } },
  });

  if (identity) {
    if (identity.user.deletedAt) {
      throw new Error("Esta cuenta está archivada.");
    }
    if (!identity.user.isActive) {
      throw new Error("Esta cuenta está desactivada.");
    }

    await prisma.platformAuthIdentity.update({
      where: { id: identity.id },
      data: {
        providerEmail: profile.providerEmail,
        emailVerified: profile.emailVerified,
        providerLogin: profile.providerLogin,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        metadata: profile.metadata,
        lastUsedAt: new Date(),
      },
    });

    const user = await updateTwitchMembership(prisma, identity.user, profile);
    return { status: "authenticated", user: compactUser(user) };
  }

  const matchingUser = profile.providerEmail
    ? await prisma.platformUser.findUnique({ where: { email: profile.providerEmail }, include: USER_INCLUDE })
    : null;

  if (matchingUser) {
    if (matchingUser.deletedAt) throw new Error("Esta cuenta está archivada.");
    if (!matchingUser.isActive) throw new Error("Esta cuenta está desactivada.");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const attempt = await prisma.platformIdentityLinkAttempt.create({
      data: { id: crypto.randomBytes(32).toString("hex"), userId: matchingUser.id, ...profile, expiresAt },
    });
    return {
      status: "link-required",
      attemptId: attempt.id,
      expiresAt,
      loginMethods: resolveLinkLoginMethods(matchingUser, profile.provider),
    };
  }

  if (!profile.providerEmail) {
    throw new Error("El proveedor no entregó un correo para crear la cuenta.");
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const attempt = await prisma.platformIdentityLinkAttempt.create({
    data: { id: crypto.randomBytes(32).toString("hex"), ...profile, expiresAt },
  });
  const login = await buildAvailableLogin(prisma, profile);

  return {
    status: "registration-required",
    attemptId: attempt.id,
    expiresAt,
    registration: serializeOAuthRegistrationAttempt(attempt, login),
  };
}

export async function linkOAuthIdentityToUser(input, userId) {
  const prisma = getPrismaClient();
  const profile = normalizeOAuthProfile(input);
  const existing = await prisma.platformAuthIdentity.findUnique({
    where: { provider_providerSubject: { provider: profile.provider, providerSubject: profile.providerSubject } },
  });
  if (existing && existing.userId !== Number(userId)) {
    throw new Error("Esta cuenta externa ya está conectada a otro usuario.");
  }

  const user = await prisma.platformUser.findUnique({ where: { id: Number(userId) }, include: USER_INCLUDE });
  if (!user || user.deletedAt || !user.isActive) throw new Error("No autorizado.");
  const connectedProvider = user.authIdentities.find((identity) => identity.provider === profile.provider);
  if (connectedProvider && connectedProvider.providerSubject !== profile.providerSubject) {
    throw new Error(`Ya tienes otra cuenta de ${profile.provider === "google" ? "Google" : "Twitch"} conectada.`);
  }

  if (!existing) {
    await prisma.platformAuthIdentity.create({ data: { userId: Number(userId), ...profile, lastUsedAt: new Date() } });
  }
  const saved = await updateTwitchMembership(prisma, user, profile);
  return compactUser(saved);
}

export async function consumeIdentityLinkAttempt(attemptId, userId) {
  const prisma = getPrismaClient();
  const attempt = await prisma.platformIdentityLinkAttempt.findUnique({ where: { id: String(attemptId || "") } });
  if (!attempt || attempt.consumedAt || attempt.expiresAt <= new Date() || attempt.userId !== Number(userId)) {
    throw new Error("La vinculación expiró o no corresponde a esta cuenta.");
  }

  const profile = normalizeOAuthProfile(attempt);
  const user = await linkOAuthIdentityToUser(profile, userId);
  await prisma.platformIdentityLinkAttempt.update({ where: { id: attempt.id }, data: { consumedAt: new Date() } });
  return { user, provider: profile.provider };
}

export async function getOAuthRegistrationAttempt(attemptId) {
  const prisma = getPrismaClient();
  const attempt = await prisma.platformIdentityLinkAttempt.findUnique({ where: { id: String(attemptId || "") } });
  if (!attempt || attempt.userId || attempt.consumedAt || attempt.expiresAt <= new Date()) {
    throw new Error("El registro conectado expiró. Inicia sesión con el proveedor nuevamente.");
  }
  const login = await buildAvailableLogin(prisma, normalizeOAuthProfile(attempt));
  return serializeOAuthRegistrationAttempt(attempt, login);
}

export async function registerOAuthUser(input, attemptId) {
  const prisma = getPrismaClient();
  const login = normalizeLogin(input?.login);
  const alias = String(input?.alias || "").trim();
  const password = String(input?.password || "");
  const confirmPassword = String(input?.confirmPassword || "");

  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    throw new Error("El usuario debe tener 3 a 32 caracteres: letras, números, punto, guion o guion bajo.");
  }

  validateAlias(alias);

  const shouldCreatePassword = Boolean(password || confirmPassword);
  let credentials = null;

  if (shouldCreatePassword) {
    validatePassword(password);

    if (!confirmPassword) {
      throw new Error("Confirma tu contraseña.");
    }

    if (password !== confirmPassword) {
      throw new Error("Las contraseñas no coinciden.");
    }

    credentials = hashPassword(password);
  }

  await ensurePlatformRoles(prisma);
  const attempt = await prisma.platformIdentityLinkAttempt.findUnique({ where: { id: String(attemptId || "") } });
  if (!attempt || attempt.userId || attempt.consumedAt || attempt.expiresAt <= new Date()) {
    throw new Error("El registro conectado expiró. Inicia sesión con el proveedor nuevamente.");
  }

  const profile = normalizeOAuthProfile(attempt);
  if (!profile.providerEmail) {
    throw new Error("El proveedor no entregó un correo para crear la cuenta.");
  }

  const existing = await prisma.platformUser.findFirst({
    where: {
      OR: [
        { login },
        { email: profile.providerEmail },
      ],
    },
    select: { id: true, login: true, email: true },
  });

  if (existing?.login === login) {
    throw new Error("Ese usuario ya existe.");
  }

  if (existing?.email === profile.providerEmail) {
    throw new Error("Ese email ya está registrado.");
  }

  const identity = await prisma.platformAuthIdentity.findUnique({
    where: { provider_providerSubject: { provider: profile.provider, providerSubject: profile.providerSubject } },
    select: { id: true },
  });
  if (identity) {
    throw new Error("Esta cuenta externa ya está conectada a otro usuario.");
  }

  const role = await resolveRole(prisma, DEFAULT_ROLE_CODE);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.platformUser.create({
      data: {
        login,
        alias,
        email: profile.providerEmail,
        avatarUrl: profile.avatarUrl,
        passwordHash: credentials?.hash || null,
        passwordSalt: credentials?.salt || null,
        passwordUpdatedAt: credentials ? new Date() : null,
        roleId: role.id,
        isActive: true,
        authIdentities: { create: { ...profile, lastUsedAt: new Date() } },
      },
      include: USER_INCLUDE,
    });
    await tx.platformIdentityLinkAttempt.update({ where: { id: attempt.id }, data: { consumedAt: new Date() } });
    return updateTwitchMembership(tx, created, profile);
  });

  return compactUser(user);
}

export async function disconnectOAuthIdentity(userId, provider) {
  const prisma = getPrismaClient();
  const user = await prisma.platformUser.findUnique({ where: { id: Number(userId) }, include: USER_INCLUDE });
  if (!user || user.deletedAt) throw new Error("No autorizado.");
  const identity = user.authIdentities.find((item) => item.provider === String(provider || "").toLowerCase());
  if (!identity) throw new Error("La cuenta externa no está conectada.");
  if (!user.passwordHash && user.authIdentities.length <= 1) {
    throw new Error("No puedes desconectar tu único método de acceso.");
  }
  await prisma.platformAuthIdentity.delete({ where: { id: identity.id } });
  if (identity.provider === "twitch") {
    const shouldResetTwitchRole = user.roleSource === "twitch" && TWITCH_AUTOMATIC_ROLE_CODES.has(user.role?.code);
    const publicRole = shouldResetTwitchRole ? await resolveRole(prisma, DEFAULT_ROLE_CODE) : null;
    await prisma.platformUser.update({
      where: { id: user.id },
      data: {
        twitchUserId: null,
        twitchSubscriberTier: null,
        isTwitchModerator: false,
        isTwitchVip: false,
        twitchRoleSyncedAt: null,
        ...(publicRole ? { roleId: publicRole.id, roleSource: "manual" } : {}),
      },
    });
  }
  const saved = await prisma.platformUser.findUnique({ where: { id: user.id }, include: USER_INCLUDE });
  return compactUser(saved);
}

export async function findOrCreateTwitchUser(profile) {
  return resolveOAuthIdentity({
    provider: "twitch",
    providerSubject: profile?.id,
    providerEmail: profile?.email,
    emailVerified: false,
    providerLogin: profile?.login,
    displayName: profile?.alias,
    avatarUrl: profile?.avatarUrl,
    metadata: { twitchMembership: profile?.twitchMembership || null },
  });
}

export async function createPlatformSession(userId) {
  const prisma = getPrismaClient();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = getSessionExpiry();
  const lastLoginAt = new Date();

  const [session, user] = await prisma.$transaction([
    prisma.platformSession.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    }),
    prisma.platformUser.update({
      where: { id: Number(userId) },
      data: { lastLoginAt },
      include: USER_INCLUDE,
    }),
  ]);

  return { token: session.token, expiresAt: session.expiresAt, user: compactUser(user) };
}

export async function getPlatformUserBySessionToken(token) {
  if (!token) {
    return null;
  }

  const prisma = getPrismaClient();
  let session = await prisma.platformSession.findUnique({
    where: { token },
    include: { user: { include: USER_INCLUDE } },
  });

  if (!session || session.expiresAt <= new Date() || !session.user?.isActive || session.user?.deletedAt) {
    return null;
  }

  const roleCode = session.user.role?.code;
  const permissionCodes = (session.user.role?.permissions || [])
    .map((item) => item.permission?.code)
    .filter(Boolean);
  const shouldSyncTrackerCalendarPermission = (
    [...TRACKER_CALENDAR_DEFAULT_ROLE_CODES, "admin", "moderador"].includes(roleCode) &&
    !permissionCodes.includes(TRACKER_CALENDAR_PERMISSION_CODE)
  );
  const shouldSyncAnimeCalendarPermission = (
    ANIME_CALENDAR_DEFAULT_ROLE_CODES.includes(roleCode)
    && !permissionCodes.includes(ANIME_CALENDAR_PERMISSION_CODE)
  );
  const shouldSyncAnimeTierListPermissions = (
    ANIME_CALENDAR_DEFAULT_ROLE_CODES.includes(roleCode)
    && (!permissionCodes.includes(ANIME_TIER_LIST_ANIMES_PERMISSION_CODE) || !permissionCodes.includes(ANIME_TIER_LIST_OPENINGS_PERMISSION_CODE))
  );
  const shouldSyncAnimeTierListManagePermission = (
    ANIME_TIER_LIST_OPENINGS_MANAGE_DEFAULT_ROLE_CODES.includes(roleCode)
    && !permissionCodes.includes(ANIME_TIER_LIST_OPENINGS_MANAGE_PERMISSION_CODE)
  );

  if (shouldSyncTrackerCalendarPermission || shouldSyncAnimeCalendarPermission || shouldSyncAnimeTierListPermissions || shouldSyncAnimeTierListManagePermission) {
    await ensurePlatformPermissions(prisma);
    session = await prisma.platformSession.findUnique({
      where: { token },
      include: { user: { include: USER_INCLUDE } },
    });
  }

  return compactUser(session.user);
}

export async function deletePlatformSession(token) {
  if (!token) {
    return;
  }

  const prisma = getPrismaClient();
  await prisma.platformSession.deleteMany({
    where: { token },
  });
}
