import { createPlatformNotificationOnce } from "./repositories/notificationRepository.js";

const CONTENT_NOTIFICATIONS = [
  {
    dedupeKey: "release:v2.12.1",
    type: "activity",
    source: "content",
    severity: "success",
    title: "Nueva versión v2.12.1",
    body: "La plataforma mejora sus mantenedores, modales y notificaciones con una experiencia más clara, consistente y cómoda, junto con correcciones en Twitch EventSub.",
    href: "/changelog",
    icon: "Sparkles",
    audience: "all",
    metadata: { source: "release", version: "v2.12.1" },
  },
  {
    dedupeKey: "release:v2.12.0",
    type: "activity",
    source: "content",
    severity: "success",
    title: "Nueva versión v2.12.0",
    body: "El Rastreador estrena filtros de enlaces y un flujo seguro para exportar, revisar e importar actualizaciones mediante Excel.",
    href: "/changelog",
    icon: "Sparkles",
    audience: "all",
    metadata: { source: "release", version: "v2.12.0" },
  },
  {
    dedupeKey: "release:v2.11.0",
    type: "activity",
    source: "content",
    severity: "success",
    title: "Nueva versión v2.11.0",
    body: "Sugerencias/Reclamos estrena tickets con conversación, notificaciones y mantenedor administrativo en tiempo real.",
    href: "/changelog",
    icon: "Sparkles",
    audience: "all",
    metadata: { source: "release", version: "v2.11.0" },
  },
  {
    dedupeKey: "release:v2.10.0",
    type: "activity",
    source: "content",
    severity: "success",
    title: "Nueva versión v2.10.0",
    body: "RTFM reúne las fuentes del archivo y suma un mapa de navegación con roles, permisos y accesos por pantalla.",
    href: "/changelog",
    icon: "Sparkles",
    audience: "all",
    metadata: { source: "release", version: "v2.10.0" },
  },
  {
    dedupeKey: "release:v2.9.1",
    type: "activity",
    source: "content",
    severity: "success",
    title: "Nueva versión v2.9.1",
    body: "El perfil recupera el menú lateral completo y aclara el alcance actual de los beneficios automáticos.",
    href: "/changelog",
    icon: "Sparkles",
    audience: "all",
    metadata: { source: "release", version: "v2.9.1" },
  },
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
