import { broadcastNotificationUpdate } from "../notificationRealtime.js";
import { getPrismaClient } from "../prisma.js";
import { can, userCanAdmin } from "./platformUserRepository.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 80;
const MAX_MARK_ALL = 200;
const RESUBIDO_NOTIFY_COOLDOWN_MS = 10_000;
const VALID_TYPES = new Set(["alert", "activity", "system"]);
const VALID_SEVERITIES = new Set(["info", "success", "warning", "danger"]);
const VALID_SOURCES = new Set(["manual", "system", "twitch", "youtube", "tracker", "anime", "spacedrum", "content", "support-ticket"]);
let warnedMissingDedupeKey = false;

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function normalizeLimit(limit, fallback = DEFAULT_LIMIT, max = MAX_LIMIT) {
  return Math.min(Math.max(Number(limit) || fallback, 1), max);
}

function normalizeType(type) {
  const value = String(type || "").trim().toLowerCase();
  return VALID_TYPES.has(value) ? value : "activity";
}

function normalizeSeverity(severity) {
  const value = String(severity || "").trim().toLowerCase();
  return VALID_SEVERITIES.has(value) ? value : "info";
}

function normalizeAudience(audience) {
  const value = String(audience || "").trim().toLowerCase();
  return value || "authenticated";
}

function normalizeSource(source) {
  const value = String(source || "").trim().toLowerCase();
  return VALID_SOURCES.has(value) ? value : "system";
}

function normalizeOptionalDate(value, fieldLabel) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldLabel} no es una fecha válida.`);
  return date;
}

function validateAudience(audience) {
  const value = normalizeAudience(audience);
  if (["all", "authenticated", "admin"].includes(value)) return value;
  if (/^permission:[a-z0-9._-]+$/.test(value)) return value;
  if (/^user:\d+$/.test(value)) return value;
  throw new Error("La audiencia seleccionada no es válida.");
}

function isMissingDedupeKeyColumn(error) {
  return error?.code === "P2022" && String(error?.meta?.column || "").includes("dedupeKey");
}

function warnMissingDedupeKeyColumn() {
  if (warnedMissingDedupeKey) {
    return;
  }

  warnedMissingDedupeKey = true;
  console.warn("La columna PlatformNotification.dedupeKey no existe todavía. Aplica las migraciones para activar notificaciones únicas de novedades/changelog.");
}

function notificationIsVisibleToUser(notification, user) {
  const audience = normalizeAudience(notification?.audience);

  if (notification?.expiresAt && notification.expiresAt <= new Date()) {
    return false;
  }

  if (notification?.isActive === false || notification?.deletedAt || !notification?.publishedAt || notification.publishedAt > new Date()) {
    return false;
  }

  if (audience === "all") {
    return true;
  }

  if (!user?.id || !user?.isActive) {
    return false;
  }

  if (audience === "authenticated") {
    return true;
  }

  if (audience === "admin") {
    return userCanAdmin(user);
  }

  if (audience.startsWith("permission:")) {
    return can(user, audience.slice("permission:".length));
  }

  if (audience.startsWith("user:")) {
    return String(user.id) === audience.slice("user:".length);
  }

  return false;
}

function getAudienceWhere(user) {
  const sharedAudiences = ["all"];

  if (user?.id && user?.isActive) {
    sharedAudiences.push("authenticated");

    if (userCanAdmin(user)) {
      sharedAudiences.push("admin");
    }
  }

  return [
    { audience: { in: sharedAudiences } },
    ...(user?.id ? [{ audience: `user:${user.id}` }, { audience: { startsWith: "permission:" } }] : []),
  ];
}

function compactNotification(notification, user) {
  const state = notification.userStates?.[0] || null;

  return {
    id: notification.id,
    type: notification.type,
    severity: notification.severity,
    source: notification.source,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    icon: notification.icon,
    metadata: notification.metadata,
    dedupeKey: notification.dedupeKey,
    audience: notification.audience,
    createdByUserId: notification.createdByUserId,
    createdAt: notification.createdAt?.toISOString() || null,
    updatedAt: notification.updatedAt?.toISOString() || null,
    scheduledAt: notification.scheduledAt?.toISOString() || null,
    publishedAt: notification.publishedAt?.toISOString() || null,
    expiresAt: notification.expiresAt?.toISOString() || null,
    deletedAt: notification.deletedAt?.toISOString() || null,
    isActive: notification.isActive !== false,
    readAt: state?.readAt?.toISOString() || null,
    dismissedAt: state?.dismissedAt?.toISOString() || null,
    isRead: Boolean(state?.readAt),
    isDismissed: Boolean(state?.dismissedAt),
    isVisible: notificationIsVisibleToUser(notification, user),
  };
}

async function findVisibleNotifications({ user = null, limit = DEFAULT_LIMIT, includeDismissed = false, all = false } = {}) {
  if (!usePostgres()) {
    return [];
  }

  const prisma = getPrismaClient();
  const requestedLimit = normalizeLimit(limit, DEFAULT_LIMIT, MAX_MARK_ALL);
  const take = Math.min(requestedLimit * 3, 240);
  const now = new Date();
  const include = user?.id
    ? {
        userStates: {
          where: { userId: Number(user.id) },
          take: 1,
        },
      }
    : undefined;

  try {
    const notifications = await prisma.platformNotification.findMany({
      where: {
        OR: getAudienceWhere(user),
        AND: [
          { isActive: true },
          { deletedAt: null },
          { publishedAt: { lte: now } },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
        ],
      },
      ...(include ? { include } : {}),
      orderBy: { createdAt: "desc" },
      ...(all ? {} : { take }),
    });

    return notifications
      .map((notification) => compactNotification(notification, user))
      .filter((notification) => notification.isVisible)
      .filter((notification) => includeDismissed || !notification.isDismissed)
      .slice(0, all ? undefined : requestedLimit);
  } catch (error) {
    console.error("No se pudieron leer las notificaciones:", error);
    return [];
  }
}

export async function listNotifications({ user = null, limit = DEFAULT_LIMIT } = {}) {
  const [notifications, unreadNotifications] = await Promise.all([
    findVisibleNotifications({ user, limit }),
    findVisibleNotifications({ user, limit: MAX_MARK_ALL }),
  ]);
  const unreadCount = unreadNotifications.filter((notification) => !notification.isRead).length;

  return {
    notifications,
    unreadCount,
  };
}

export async function markNotificationRead({ user, notificationId }) {
  if (!usePostgres() || !user?.id || !notificationId) {
    return null;
  }

  const prisma = getPrismaClient();
  const notification = await prisma.platformNotification.findUnique({
    where: { id: Number(notificationId) },
  }).catch(() => null);

  if (!notification || !notificationIsVisibleToUser(notification, user)) {
    return null;
  }

  try {
    const state = await prisma.platformUserNotification.upsert({
      where: {
        userId_notificationId: {
          userId: Number(user.id),
          notificationId: Number(notificationId),
        },
      },
      update: { readAt: new Date() },
      create: {
        userId: Number(user.id),
        notificationId: Number(notificationId),
        readAt: new Date(),
      },
    });
    broadcastNotificationUpdate({ reason: "user-notification-state", userId: Number(user.id), notificationId: Number(notificationId) });
    return state;
  } catch (error) {
    console.error("No se pudo marcar la notificación como leída:", error);
    return null;
  }
}

export async function markNotificationUnread({ user, notificationId }) {
  if (!usePostgres() || !user?.id || !notificationId) return null;
  const prisma = getPrismaClient();
  const notification = await prisma.platformNotification.findUnique({ where: { id: Number(notificationId) } }).catch(() => null);
  if (!notification || !notificationIsVisibleToUser(notification, user)) return null;
  const state = await prisma.platformUserNotification.upsert({
    where: { userId_notificationId: { userId: Number(user.id), notificationId: Number(notificationId) } },
    update: { readAt: null },
    create: { userId: Number(user.id), notificationId: Number(notificationId) },
  });
  broadcastNotificationUpdate({ reason: "user-notification-state", userId: Number(user.id), notificationId: Number(notificationId) });
  return state;
}

export async function dismissNotification({ user, notificationId }) {
  if (!usePostgres() || !user?.id || !notificationId) {
    return null;
  }

  const prisma = getPrismaClient();
  const notification = await prisma.platformNotification.findUnique({
    where: { id: Number(notificationId) },
  }).catch(() => null);

  if (!notification || !notificationIsVisibleToUser(notification, user)) {
    return null;
  }

  try {
    const state = await prisma.platformUserNotification.upsert({
      where: {
        userId_notificationId: {
          userId: Number(user.id),
          notificationId: Number(notificationId),
        },
      },
      update: { dismissedAt: new Date(), readAt: new Date() },
      create: {
        userId: Number(user.id),
        notificationId: Number(notificationId),
        dismissedAt: new Date(),
        readAt: new Date(),
      },
    });
    broadcastNotificationUpdate({ reason: "user-notification-state", userId: Number(user.id), notificationId: Number(notificationId) });
    return state;
  } catch (error) {
    console.error("No se pudo descartar la notificación:", error);
    return null;
  }
}

export async function restoreNotification({ user, notificationId }) {
  if (!usePostgres() || !user?.id || !notificationId) return null;
  const prisma = getPrismaClient();
  const notification = await prisma.platformNotification.findUnique({ where: { id: Number(notificationId) } }).catch(() => null);
  if (!notification || !notificationIsVisibleToUser(notification, user)) return null;
  const state = await prisma.platformUserNotification.upsert({
    where: { userId_notificationId: { userId: Number(user.id), notificationId: Number(notificationId) } },
    update: { dismissedAt: null },
    create: { userId: Number(user.id), notificationId: Number(notificationId) },
  });
  broadcastNotificationUpdate({ reason: "user-notification-state", userId: Number(user.id), notificationId: Number(notificationId) });
  return state;
}

export async function listUserNotifications({ user, search = "", type = "all", status = "all", page = 1, pageSize = 10 } = {}) {
  const all = await findVisibleNotifications({ user, includeDismissed: true, all: true });
  const needle = String(search || "").trim().toLocaleLowerCase("es");
  const filtered = all.filter((notification) => {
    if (type !== "all" && notification.type !== type) return false;
    if (status === "dismissed" && !notification.isDismissed) return false;
    if (status !== "dismissed" && notification.isDismissed) return false;
    if (status === "unread" && notification.isRead) return false;
    if (status === "read" && !notification.isRead) return false;
    return !needle || `${notification.title} ${notification.body || ""}`.toLocaleLowerCase("es").includes(needle);
  });
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 5000);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  return {
    notifications: filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    unreadCount: all.filter((item) => !item.isRead && !item.isDismissed).length,
    dismissedCount: all.filter((item) => item.isDismissed).length,
  };
}

export async function markAllNotificationsRead({ user }) {
  if (!usePostgres() || !user?.id) {
    return 0;
  }

  const prisma = getPrismaClient();
  const notifications = await findVisibleNotifications({
    user,
    includeDismissed: false,
    all: true,
  });
  const unreadIds = notifications
    .filter((notification) => !notification.isRead)
    .map((notification) => notification.id);

  if (!unreadIds.length) {
    return 0;
  }

  const now = new Date();

  try {
    await prisma.$transaction([
      prisma.platformUserNotification.updateMany({
        where: {
          userId: Number(user.id),
          notificationId: { in: unreadIds },
        },
        data: { readAt: now },
      }),
      prisma.platformUserNotification.createMany({
        data: unreadIds.map((notificationId) => ({
          userId: Number(user.id),
          notificationId,
          readAt: now,
        })),
        skipDuplicates: true,
      }),
    ]);

    broadcastNotificationUpdate({ reason: "user-notification-state", userId: Number(user.id), action: "mark-all-read" });
    return unreadIds.length;
  } catch (error) {
    console.error("No se pudieron marcar todas las notificaciones:", error);
    return 0;
  }
}

export async function createPlatformNotification({
  type = "activity",
  severity = "info",
  source = "system",
  title,
  body = null,
  href = null,
  icon = null,
  metadata = null,
  dedupeKey = null,
  audience = "authenticated",
  actor = null,
  expiresAt = null,
  scheduledAt = null,
}) {
  if (!usePostgres() || !title) {
    return null;
  }

  const prisma = getPrismaClient();
  const normalizedScheduledAt = normalizeOptionalDate(scheduledAt, "La publicación");
  const normalizedExpiresAt = normalizeOptionalDate(expiresAt, "La expiración");
  if (normalizedExpiresAt && normalizedScheduledAt && normalizedExpiresAt <= normalizedScheduledAt) {
    throw new Error("La expiración debe ser posterior a la publicación.");
  }

  try {
    const notification = await prisma.platformNotification.create({
      data: {
        type: normalizeType(type),
        severity: normalizeSeverity(severity),
        source: normalizeSource(source),
        title: String(title).trim(),
        body: body == null ? null : String(body).trim(),
        href: href == null ? null : String(href).trim(),
        icon: icon == null ? null : String(icon).trim(),
        metadata: metadata == null ? undefined : metadata,
        ...(dedupeKey == null ? {} : { dedupeKey: String(dedupeKey).trim() }),
        audience: validateAudience(audience),
        createdByUserId: actor?.id ? Number(actor.id) : null,
        scheduledAt: normalizedScheduledAt,
        publishedAt: normalizedScheduledAt && normalizedScheduledAt > new Date() ? null : new Date(),
        expiresAt: normalizedExpiresAt,
      },
    });

    if (notification.publishedAt) {
      broadcastNotificationUpdate({ notificationId: notification.id, notificationType: notification.type, audience: notification.audience });
    }

    return notification;
  } catch (error) {
    console.error("No se pudo crear la notificación:", error);
    return null;
  }
}

export async function createResubidoNotification({ live, actor = null }) {
  if (!usePostgres() || !live?.dbId || !live?.id || !live?.title) {
    return null;
  }

  const prisma = getPrismaClient();
  const notifiedAt = new Date();
  const notification = await prisma.$transaction(async (transaction) => {
    const claimedLive = await transaction.live.updateMany({
      where: {
        id: Number(live.dbId),
        OR: [
          { notifiedAt: null },
          { notifiedAt: { lt: new Date(notifiedAt.getTime() - RESUBIDO_NOTIFY_COOLDOWN_MS) } },
        ],
      },
      data: { notifiedAt },
    });

    if (!claimedLive.count) {
      const error = new Error("La notificación ya fue enviada recientemente.");
      error.code = "RESUBIDO_NOTIFY_COOLDOWN";
      throw error;
    }

    const created = await transaction.platformNotification.create({
      data: {
        type: "activity",
        severity: "info",
        source: "tracker",
        title: "Nuevo resubido disponible",
        body: live.title,
        href: `/rastreador/${live.id}`,
        icon: "PlayCircle",
        audience: "all",
        publishedAt: notifiedAt,
        createdByUserId: actor?.id ? Number(actor.id) : null,
      },
    });

    return created;
  });

  broadcastNotificationUpdate({
    notificationId: notification.id,
    notificationType: notification.type,
    audience: notification.audience,
  });

  return { notification, notifiedAt };
}

export async function createPlatformNotificationOnce({ dedupeKey, ...input }) {
  const normalizedDedupeKey = String(dedupeKey || "").trim();

  if (!normalizedDedupeKey) {
    return createPlatformNotification(input);
  }

  if (!usePostgres()) {
    return null;
  }

  const prisma = getPrismaClient();

  try {
    const existing = await prisma.platformNotification.findUnique({
      where: { dedupeKey: normalizedDedupeKey },
    });

    if (existing) {
      return existing;
    }

    return await createPlatformNotification({
      ...input,
      dedupeKey: normalizedDedupeKey,
    });
  } catch (error) {
    if (isMissingDedupeKeyColumn(error)) {
      warnMissingDedupeKeyColumn();
      return null;
    }

    if (error?.code === "P2002") {
      return prisma.platformNotification.findUnique({
        where: { dedupeKey: normalizedDedupeKey },
      }).catch(() => null);
    }

    console.error("No se pudo crear la notificación única:", error);
    return null;
  }
}

function compactAdminNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    severity: notification.severity,
    source: notification.source,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    icon: notification.icon,
    audience: notification.audience,
    dedupeKey: notification.dedupeKey,
    metadata: notification.metadata,
    isActive: notification.isActive,
    createdByUserId: notification.createdByUserId,
    createdBy: notification.createdBy ? { id: notification.createdBy.id, login: notification.createdBy.login, alias: notification.createdBy.alias } : null,
    createdAt: notification.createdAt?.toISOString() || null,
    updatedAt: notification.updatedAt?.toISOString() || null,
    scheduledAt: notification.scheduledAt?.toISOString() || null,
    publishedAt: notification.publishedAt?.toISOString() || null,
    expiresAt: notification.expiresAt?.toISOString() || null,
    deletedAt: notification.deletedAt?.toISOString() || null,
    userStateCount: notification._count?.userStates || 0,
  };
}

export async function listAdminNotifications({ search = "", type = "all", severity = "all", source = "all", status = "all", page = 1, pageSize = 10, sort = "id", direction = "desc" } = {}) {
  if (!usePostgres()) return { notifications: [], total: 0, page: 1, pageSize: 10, totalPages: 1, stats: {} };
  const prisma = getPrismaClient();
  const now = new Date();
  const searchTerm = String(search).trim();
  const conditions = [];
  if (searchTerm) conditions.push({ OR: [
    { title: { contains: searchTerm, mode: "insensitive" } },
    { body: { contains: searchTerm, mode: "insensitive" } },
    { severity: { contains: searchTerm, mode: "insensitive" } },
    { type: { contains: searchTerm, mode: "insensitive" } },
    { source: { contains: searchTerm, mode: "insensitive" } },
    { audience: { contains: searchTerm, mode: "insensitive" } },
    ...(/^#?\d+$/.test(searchTerm) ? [{ id: Number(searchTerm.replace("#", "")) }] : []),
  ] });
  if (status === "published") conditions.push({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
  const where = {
    ...(conditions.length ? { AND: conditions } : {}),
    ...(type !== "all" ? { type } : {}),
    ...(severity !== "all" ? { severity } : {}),
    ...(source !== "all" ? { source } : {}),
    ...(status === "deleted" ? { deletedAt: { not: null } } : {}),
    ...(status === "inactive" ? { deletedAt: null, isActive: false } : {}),
    ...(status === "scheduled" ? { deletedAt: null, isActive: true, publishedAt: null, scheduledAt: { gt: now } } : {}),
    ...(status === "published" ? { deletedAt: null, isActive: true, publishedAt: { lte: now } } : {}),
    ...(status === "expired" ? { deletedAt: null, expiresAt: { lte: now } } : {}),
  };
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 5000);
  const sortFields = {
    id: "id",
    title: "title",
    severity: "severity",
    type: "type",
    source: "source",
    audience: "audience",
    published: "publishedAt",
  };
  const sortField = sortFields[sort] || "id";
  const sortDirection = direction === "asc" ? "asc" : "desc";
  const orderBy = [{ [sortField]: sortDirection }, ...(sortField === "id" ? [] : [{ id: "desc" }])];
  const [total, rows, allRows] = await Promise.all([
    prisma.platformNotification.count({ where }),
    prisma.platformNotification.findMany({ where, include: { createdBy: true, _count: { select: { userStates: true } } }, orderBy, skip: (Math.max(Number(page) || 1, 1) - 1) * safePageSize, take: safePageSize }),
    prisma.platformNotification.findMany({ select: { isActive: true, publishedAt: true, scheduledAt: true, expiresAt: true, deletedAt: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  return {
    notifications: rows.map(compactAdminNotification), total, page: safePage, pageSize: safePageSize, totalPages,
    stats: {
      total: allRows.length,
      published: allRows.filter((item) => item.isActive && !item.deletedAt && item.publishedAt && item.publishedAt <= now && (!item.expiresAt || item.expiresAt > now)).length,
      scheduled: allRows.filter((item) => item.isActive && !item.deletedAt && !item.publishedAt && item.scheduledAt > now).length,
      inactive: allRows.filter((item) => !item.isActive && !item.deletedAt).length,
    },
  };
}

export async function getAdminNotificationById(id) {
  if (!usePostgres()) return null;
  const notification = await getPrismaClient().platformNotification.findUnique({
    where: { id: Number(id) }, include: { createdBy: true, _count: { select: { userStates: true } } },
  });
  return notification ? compactAdminNotification(notification) : null;
}

export async function saveAdminNotification(input, { actor }) {
  if (!usePostgres()) throw new Error("El mantenedor de notificaciones requiere PostgreSQL.");
  const prisma = getPrismaClient();
  const id = Number(input?.id) || null;
  const title = String(input?.title || "").trim();
  if (!title) throw new Error("El título es obligatorio.");
  const scheduledAt = normalizeOptionalDate(input?.scheduledAt, "La publicación");
  const expiresAt = normalizeOptionalDate(input?.expiresAt, "La expiración");
  if (expiresAt && scheduledAt && expiresAt <= scheduledAt) throw new Error("La expiración debe ser posterior a la publicación.");
  const existing = id ? await prisma.platformNotification.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new Error("La notificación no existe.");
  const publishNow = input?.publishMode !== "scheduled" || !scheduledAt || scheduledAt <= new Date();
  const data = {
    type: normalizeType(input?.type), severity: normalizeSeverity(input?.severity), source: normalizeSource(input?.source || "manual"),
    title, body: input?.body ? String(input.body).trim() : null, href: input?.href ? String(input.href).trim() : null,
    icon: input?.icon ? String(input.icon).trim() : null, audience: validateAudience(input?.audience),
    isActive: input?.isActive !== false, scheduledAt: publishNow ? null : scheduledAt,
    publishedAt: publishNow ? (existing?.publishedAt || new Date()) : null, expiresAt,
  };
  const saved = id
    ? await prisma.platformNotification.update({ where: { id }, data, include: { createdBy: true, _count: { select: { userStates: true } } } })
    : await prisma.platformNotification.create({ data: { ...data, source: input?.source ? normalizeSource(input.source) : "manual", createdByUserId: actor?.id ? Number(actor.id) : null }, include: { createdBy: true, _count: { select: { userStates: true } } } });
  if (saved.publishedAt && saved.isActive && !saved.deletedAt) broadcastNotificationUpdate({ notificationId: saved.id, notificationType: saved.type, audience: saved.audience });
  return compactAdminNotification(saved);
}

export async function updateAdminNotificationState(id, action) {
  if (!usePostgres()) throw new Error("El mantenedor de notificaciones requiere PostgreSQL.");
  const prisma = getPrismaClient();
  const notificationId = Number(id);
  const data = action === "delete" ? { deletedAt: new Date() }
    : action === "restore" ? { deletedAt: null }
      : action === "activate" ? { isActive: true }
        : action === "deactivate" ? { isActive: false }
          : null;
  if (!data) throw new Error("Acción de estado no soportada.");
  const saved = await prisma.platformNotification.update({ where: { id: notificationId }, data, include: { createdBy: true, _count: { select: { userStates: true } } } });
  broadcastNotificationUpdate({ notificationId: saved.id, notificationType: saved.type, audience: saved.audience });
  return compactAdminNotification(saved);
}

export async function publishDueNotifications() {
  if (!usePostgres()) return 0;
  const prisma = getPrismaClient();
  const now = new Date();
  const due = await prisma.platformNotification.findMany({
    where: { isActive: true, deletedAt: null, publishedAt: null, scheduledAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { id: true }, take: 100,
  });
  let published = 0;
  for (const item of due) {
    const claimed = await prisma.platformNotification.updateMany({ where: { id: item.id, publishedAt: null }, data: { publishedAt: now } });
    if (claimed.count) {
      published += 1;
      const notification = await prisma.platformNotification.findUnique({ where: { id: item.id } });
      broadcastNotificationUpdate({ notificationId: item.id, notificationType: notification.type, audience: notification.audience });
    }
  }
  return published;
}
