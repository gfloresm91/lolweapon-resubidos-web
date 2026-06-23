import { createPlatformNotificationOnce } from "./repositories/notificationRepository.js";

const CONTENT_NOTIFICATIONS = [
  {
    dedupeKey: "news:notification-center:v1",
    type: "alert",
    severity: "info",
    title: "Nuevo centro de notificaciones",
    body: "La campana ahora avisa directos, videos de YouTube y actividad relevante.",
    href: "/novedades",
    icon: "BellRing",
    audience: "all",
    metadata: { source: "news", key: "notification-center" },
  },
  {
    dedupeKey: "changelog:notification-center:v1",
    type: "activity",
    severity: "info",
    title: "Historial de cambios actualizado",
    body: "Revisa los últimos cambios de la plataforma.",
    href: "/changelog",
    icon: "BookOpen",
    audience: "all",
    metadata: { source: "changelog", key: "notification-center" },
  },
];

export async function syncContentNotifications() {
  let synced = 0;

  for (const notification of CONTENT_NOTIFICATIONS) {
    const result = await createPlatformNotificationOnce(notification);

    if (result) {
      synced += 1;
    }
  }

  return { total: CONTENT_NOTIFICATIONS.length, synced };
}
