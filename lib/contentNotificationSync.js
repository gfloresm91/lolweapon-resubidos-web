import { createPlatformNotificationOnce } from "./repositories/notificationRepository.js";

const CONTENT_NOTIFICATIONS = [
  {
    dedupeKey: "release:v2.9.0",
    type: "activity",
    source: "content",
    severity: "success",
    title: "Nueva versión v2.9.0",
    body: "Ya puedes iniciar sesión o registrarte con Google / YouTube y conectar varios métodos de acceso a una misma cuenta.",
    href: "/changelog",
    icon: "Sparkles",
    audience: "all",
    metadata: { source: "release", version: "v2.9.0" },
  },
  {
    dedupeKey: "release:v2.8.0",
    type: "activity",
    source: "content",
    severity: "success",
    title: "Nueva versión v2.8.0",
    body: "Estrenamos el centro completo de notificaciones, avisos programados y sesión compartida entre Resubidos y Viendo.",
    href: "/changelog",
    icon: "Sparkles",
    audience: "all",
    metadata: { source: "release", version: "v2.8.0" },
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
