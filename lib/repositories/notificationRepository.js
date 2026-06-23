import { broadcastNotificationUpdate } from "../notificationRealtime.js";
import { getPrismaClient } from "../prisma.js";
import { can, userCanAdmin } from "./platformUserRepository.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 80;
const MAX_MARK_ALL = 200;
const VALID_TYPES = new Set(["alert", "activity", "system"]);
const VALID_SEVERITIES = new Set(["info", "success", "warning", "danger"]);
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
    title: notification.title,
    body: notification.body,
    href: notification.href,
    icon: notification.icon,
    metadata: notification.metadata,
    dedupeKey: notification.dedupeKey,
    audience: notification.audience,
    createdByUserId: notification.createdByUserId,
    createdAt: notification.createdAt?.toISOString() || null,
    expiresAt: notification.expiresAt?.toISOString() || null,
    readAt: state?.readAt?.toISOString() || null,
    dismissedAt: state?.dismissedAt?.toISOString() || null,
    isRead: Boolean(state?.readAt),
    isDismissed: Boolean(state?.dismissedAt),
    isVisible: notificationIsVisibleToUser(notification, user),
  };
}

async function findVisibleNotifications({ user = null, limit = DEFAULT_LIMIT, includeDismissed = false } = {}) {
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
      take,
    });

    return notifications
      .map((notification) => compactNotification(notification, user))
      .filter((notification) => notification.isVisible)
      .filter((notification) => includeDismissed || !notification.isDismissed)
      .slice(0, requestedLimit);
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
    return await prisma.platformUserNotification.upsert({
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
  } catch (error) {
    console.error("No se pudo marcar la notificación como leída:", error);
    return null;
  }
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
    return await prisma.platformUserNotification.upsert({
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
  } catch (error) {
    console.error("No se pudo descartar la notificación:", error);
    return null;
  }
}

export async function markAllNotificationsRead({ user }) {
  if (!usePostgres() || !user?.id) {
    return 0;
  }

  const prisma = getPrismaClient();
  const notifications = await findVisibleNotifications({
    user,
    limit: MAX_MARK_ALL,
    includeDismissed: false,
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

    return unreadIds.length;
  } catch (error) {
    console.error("No se pudieron marcar todas las notificaciones:", error);
    return 0;
  }
}

export async function createPlatformNotification({
  type = "activity",
  severity = "info",
  title,
  body = null,
  href = null,
  icon = null,
  metadata = null,
  dedupeKey = null,
  audience = "authenticated",
  actor = null,
  expiresAt = null,
}) {
  if (!usePostgres() || !title) {
    return null;
  }

  const prisma = getPrismaClient();

  try {
    const notification = await prisma.platformNotification.create({
      data: {
        type: normalizeType(type),
        severity: normalizeSeverity(severity),
        title: String(title).trim(),
        body: body == null ? null : String(body).trim(),
        href: href == null ? null : String(href).trim(),
        icon: icon == null ? null : String(icon).trim(),
        metadata: metadata == null ? undefined : metadata,
        ...(dedupeKey == null ? {} : { dedupeKey: String(dedupeKey).trim() }),
        audience: normalizeAudience(audience),
        createdByUserId: actor?.id ? Number(actor.id) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    broadcastNotificationUpdate({
      notificationId: notification.id,
      notificationType: notification.type,
      audience: notification.audience,
    });

    return notification;
  } catch (error) {
    console.error("No se pudo crear la notificación:", error);
    return null;
  }
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
