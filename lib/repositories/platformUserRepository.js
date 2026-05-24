import crypto from "node:crypto";

import { ALIAS_PATTERN, EMAIL_MAX_LENGTH, EMAIL_PATTERN } from "@/lib/platformUserValidation";
import { getPrismaClient } from "@/lib/prisma";

const SESSION_DAYS = 14;
const DEFAULT_ROLE_CODE = "publico";
const GUEST_ROLE_CODE = "invitado";
const BOOTSTRAP_ROLE_CODE = "dios";
const RATING_WRITE_PERMISSION_CODE = "anime.rating.write";
const STREAMER_RATING_PERMISSION_CODE = "anime.rating.streamer";
const GOD_EXCLUDED_PERMISSION_CODES = new Set([STREAMER_RATING_PERMISSION_CODE]);
const PROTECTED_ROLE_CODES = new Set([BOOTSTRAP_ROLE_CODE, GUEST_ROLE_CODE]);
const LEGACY_ROLE_MAP = {
  admin: "admin",
  moderator: "moderador",
  viewer: "publico",
};
const PASSWORD_KEY_LENGTH = 64;
const ROLE_INCLUDE = { permissions: { include: { permission: true } } };
const GOD_ROLE_CODE = BOOTSTRAP_ROLE_CODE;
const ADMIN_PERMISSION_CODES = [
  "home.view",
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
  "roles.read",
  "roles.create",
  "roles.update",
  "admin.tracker.view",
  "admin.tags.view",
  "tags.create",
  "tags.update",
  "tags.delete",
  "admin.anime.tracking.view",
  "admin.anime.completed.view",
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
  "tracker.view",
  "tracker.create",
  "tracker.update",
  "tracker.delete",
  "tracker.form.full",
  "spacedrum.view",
];
const MODERATOR_PERMISSION_CODES = [
  "home.view",
  "anime.tracking.view",
  "anime.tracking.update",
  "anime.tracking.form.compact",
  "anime.completed.view",
  "anime.completed.update",
  "anime.completed.form.compact",
  "tracker.view",
  "tracker.update",
  "tracker.form.compact",
];

export const DEFAULT_PLATFORM_PERMISSIONS = [
  { code: "home.view", label: "Ver inicio", group: "Inicio", sortOrder: 1 },
  { code: "users.read", label: "Ver usuarios", group: "Usuarios", sortOrder: 10 },
  { code: "users.create", label: "Crear usuarios", group: "Usuarios", sortOrder: 20 },
  { code: "users.update", label: "Editar usuarios", group: "Usuarios", sortOrder: 30 },
  { code: "users.delete", label: "Eliminar usuarios", group: "Usuarios", sortOrder: 40 },
  { code: "roles.read", label: "Ver roles", group: "Roles", sortOrder: 50 },
  { code: "roles.create", label: "Crear roles", group: "Roles", sortOrder: 60 },
  { code: "roles.update", label: "Editar roles", group: "Roles", sortOrder: 70 },
  { code: "admin.tracker.view", label: "Ver mantenedor Rastreador", group: "Administración: Rastreador", sortOrder: 80 },
  { code: "admin.tags.view", label: "Ver mantenedor Tags", group: "Administración: Tags", sortOrder: 90 },
  { code: "tags.create", label: "Crear categorias de tags", group: "Administración: Tags", sortOrder: 100 },
  { code: "tags.update", label: "Editar tags", group: "Administración: Tags", sortOrder: 110 },
  { code: "tags.delete", label: "Eliminar tags", group: "Administración: Tags", sortOrder: 120 },
  { code: "admin.anime.tracking.view", label: "Ver mantenedor Viendo", group: "Administración: Viendo", sortOrder: 130 },
  { code: "admin.anime.completed.view", label: "Ver mantenedor Terminados", group: "Administración: Terminados", sortOrder: 140 },
  { code: "anime.tracking.view", label: "Ver Viendo", group: "Anime: Viendo", sortOrder: 150 },
  { code: "anime.tracking.create", label: "Crear en Viendo", group: "Anime: Viendo", sortOrder: 160 },
  { code: "anime.tracking.update", label: "Editar Viendo", group: "Anime: Viendo", sortOrder: 170 },
  { code: "anime.tracking.delete", label: "Eliminar de Viendo", group: "Anime: Viendo", sortOrder: 180 },
  { code: "anime.tracking.form.full", label: "Formulario completo", group: "Anime: Viendo", sortOrder: 190 },
  { code: "anime.tracking.form.compact", label: "Formulario compacto", group: "Anime: Viendo", sortOrder: 200 },
  { code: "anime.completed.view", label: "Ver Terminados", group: "Anime: Terminados", sortOrder: 210 },
  { code: "anime.completed.create", label: "Crear en Terminados", group: "Anime: Terminados", sortOrder: 220 },
  { code: "anime.completed.update", label: "Editar Terminados", group: "Anime: Terminados", sortOrder: 230 },
  { code: "anime.completed.delete", label: "Eliminar de Terminados", group: "Anime: Terminados", sortOrder: 240 },
  { code: "anime.completed.form.full", label: "Formulario completo", group: "Anime: Terminados", sortOrder: 250 },
  { code: "anime.completed.form.compact", label: "Formulario compacto", group: "Anime: Terminados", sortOrder: 260 },
  { code: "anime.rating.write", label: "Calificar anime", group: "Anime: Puntuación", sortOrder: 270 },
  { code: "anime.rating.streamer", label: "Mostrar nota destacada", group: "Anime: Puntuación", sortOrder: 280 },
  { code: "tracker.view", label: "Ver rastreador", group: "Rastreador", sortOrder: 300 },
  { code: "tracker.create", label: "Crear directos", group: "Rastreador", sortOrder: 310 },
  { code: "tracker.update", label: "Editar directos", group: "Rastreador", sortOrder: 320 },
  { code: "tracker.delete", label: "Eliminar directos", group: "Rastreador", sortOrder: 330 },
  { code: "tracker.form.full", label: "Formulario completo", group: "Rastreador", sortOrder: 340 },
  { code: "tracker.form.compact", label: "Formulario compacto", group: "Rastreador", sortOrder: 350 },
  { code: "spacedrum.view", label: "Ver SpaceDrum", group: "SpaceDrum", sortOrder: 400 },
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
    role: role?.code || null,
    roleLabel: role?.label || null,
    roleCanAdmin: role?.canAdmin || false,
    permissions: role?.permissions || [],
    roleId: user.roleId,
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
    include: { role: { include: ROLE_INCLUDE } },
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
        include: { role: { include: ROLE_INCLUDE } },
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
        include: { role: { include: ROLE_INCLUDE } },
      })
    : await prisma.platformUser.create({ data, include: { role: { include: ROLE_INCLUDE } } });

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
    include: { role: { include: ROLE_INCLUDE } },
  });

  return compactUser(user);
}

export async function authenticateManualUser({ login, password }) {
  const prisma = getPrismaClient();
  const user = await prisma.platformUser.findUnique({
    where: { login: normalizeLogin(login) },
    include: { role: { include: ROLE_INCLUDE } },
  });

  if (!user || user.deletedAt || !user.isActive || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  await prisma.platformUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return compactUser(user);
}

export async function updatePlatformUserStatus(id, isActive) {
  const prisma = getPrismaClient();
  const user = await prisma.platformUser.findUnique({
    where: { id: Number(id) },
    include: { role: { include: ROLE_INCLUDE } },
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
    include: { role: { include: ROLE_INCLUDE } },
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
    include: { role: { include: ROLE_INCLUDE } },
  });

  return compactUser(savedUser);
}

export async function updateCurrentUserPassword(input, { user = null } = {}) {
  if (!user?.id) {
    throw new Error("No autorizado.");
  }

  if (user.role === BOOTSTRAP_ROLE_CODE) {
    throw new Error("La contraseña del usuario Dios no se puede cambiar.");
  }

  const prisma = getPrismaClient();
  const currentPassword = String(input?.currentPassword || "");
  const password = String(input?.password || "");
  const confirmPassword = String(input?.confirmPassword || "");
  const existingUser = await prisma.platformUser.findUnique({
    where: { id: Number(user.id) },
    include: { role: { include: ROLE_INCLUDE } },
  });

  if (!existingUser || existingUser.deletedAt) {
    throw new Error("No autorizado.");
  }

  if (!existingUser.passwordHash || !existingUser.passwordSalt) {
    throw new Error("Esta cuenta no tiene contraseña manual configurada.");
  }

  if (!verifyPassword(currentPassword, existingUser.passwordSalt, existingUser.passwordHash)) {
    throw new Error("La contraseña actual no coincide.");
  }

  if (verifyPassword(password, existingUser.passwordSalt, existingUser.passwordHash)) {
    throw new Error("La nueva contraseña debe ser distinta a la actual.");
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
    include: { role: { include: ROLE_INCLUDE } },
  });

  return compactUser(savedUser);
}

export async function findOrCreateTwitchUser(profile) {
  const prisma = getPrismaClient();
  await ensurePlatformRoles(prisma);
  const twitchUserId = String(profile?.id || "").trim();
  const login = String(profile?.login || "").trim().toLowerCase();
  const alias = String(profile?.alias || profile?.login || "").trim();
  const email = normalizeEmail(profile?.email);

  if (!twitchUserId || !login || !alias) {
    throw new Error("Twitch no entregó datos suficientes para iniciar sesión.");
  }

  validateEmail(email);
  const twitchMembership = profile?.twitchMembership || null;
  const syncedAt = twitchMembership ? new Date() : null;
  const automaticRoleCode = resolveAutomaticTwitchRole(twitchMembership);

  const existingUser = await prisma.platformUser.findFirst({
    where: {
      OR: [
        { twitchUserId },
        { login },
        { email },
      ],
    },
    include: { role: { include: ROLE_INCLUDE } },
  });

  if (existingUser) {
    if (existingUser.deletedAt) {
      throw new Error("Esta cuenta está archivada.");
    }

    const shouldPreserveRole = ["dios", "admin"].includes(existingUser.role?.code);
    const nextRole = shouldPreserveRole ? existingUser.role : await resolveRole(prisma, automaticRoleCode);

    return prisma.platformUser.update({
      where: { id: existingUser.id },
      data: {
        twitchUserId,
        login,
        alias,
        email,
        avatarUrl: isCustomAvatarUrl(existingUser.avatarUrl) ? existingUser.avatarUrl : profile.avatarUrl || existingUser.avatarUrl,
        twitchSubscriberTier: twitchMembership?.subscriberTier || null,
        isTwitchModerator: Boolean(twitchMembership?.isModerator),
        isTwitchVip: Boolean(twitchMembership?.isVip),
        twitchRoleSyncedAt: syncedAt,
        roleId: nextRole.id,
        lastLoginAt: new Date(),
      },
      include: { role: { include: ROLE_INCLUDE } },
    });
  }

  const userCount = await prisma.platformUser.count({ where: { deletedAt: null } });
  const role = userCount > 0
    ? await resolveRole(prisma, automaticRoleCode)
    : await resolveRole(prisma, BOOTSTRAP_ROLE_CODE);

  return prisma.platformUser.create({
    data: {
      twitchUserId,
      login,
      alias,
      email,
      avatarUrl: profile.avatarUrl || null,
      twitchSubscriberTier: twitchMembership?.subscriberTier || null,
      isTwitchModerator: Boolean(twitchMembership?.isModerator),
      isTwitchVip: Boolean(twitchMembership?.isVip),
      twitchRoleSyncedAt: syncedAt,
      roleId: role.id,
      isActive: true,
      lastLoginAt: new Date(),
    },
    include: { role: { include: ROLE_INCLUDE } },
  });
}

export async function createPlatformSession(userId) {
  const prisma = getPrismaClient();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = getSessionExpiry();

  await prisma.platformSession.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getPlatformUserBySessionToken(token) {
  if (!token) {
    return null;
  }

  const prisma = getPrismaClient();
  const session = await prisma.platformSession.findUnique({
    where: { token },
    include: { user: { include: { role: { include: ROLE_INCLUDE } } } },
  });

  if (!session || session.expiresAt <= new Date() || !session.user?.isActive || session.user?.deletedAt) {
    return null;
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
