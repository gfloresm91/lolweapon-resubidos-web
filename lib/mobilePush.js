import { getFirebaseMessaging } from "./firebaseAdmin.js";
import { getPrismaClient } from "./prisma.js";

// Registro de dispositivos móviles para push (FCM) - independiente de la identidad de sesión, ver
// docs/authentication.md del repo mobile. El token FCM se guarda en texto plano (no es credencial
// de auth, ver comentario en prisma/schema.prisma sobre PlatformMobilePushToken).

/**
 * Upsert por token único. La misma función cubre invitado (userId null), login (userId presente) y
 * logout (el cliente vuelve a llamar sin Authorization, desvinculando el mismo token en vez de
 * borrarlo) - así el dispositivo sigue pudiendo recibir audience "all" como invitado tras desloguear.
 */
export async function registerPushToken({ token, userId = null, clientType, deviceId = null, platform = "android" }) {
  const prisma = getPrismaClient();
  await prisma.platformMobilePushToken.upsert({
    where: { token },
    create: { token, userId, clientType, deviceId, platform },
    update: { userId, clientType, deviceId, lastSeenAt: new Date(), disabledAt: null, failCount: 0 },
  });
}

const MAX_TOKENS_PER_BATCH = 500;
const DISABLE_ON_ERROR_CODES = new Set(["messaging/registration-token-not-registered", "messaging/invalid-argument"]);

// v1 solo resuelve "all" / "authenticated" / "user:<id>" - admin y permission:X quedan fuera a
// propósito (ver plan): son audiencias angostas que ya tienen visibilidad en tiempo real vía el
// panel admin web. "all" y "authenticated" excluyen usuarios inactivos/borrados explícitamente -
// un WHERE userId IS NOT NULL a secas no equivale a lo que hace getAudienceWhere en la web.
function buildTokenWhere(audience) {
  if (audience === "all") {
    return { disabledAt: null, OR: [{ userId: null }, { user: { isActive: true, deletedAt: null } }] };
  }
  if (audience === "authenticated") {
    return { disabledAt: null, userId: { not: null }, user: { isActive: true, deletedAt: null } };
  }
  if (audience.startsWith("user:")) {
    return { disabledAt: null, userId: Number(audience.slice("user:".length)) };
  }
  return null;
}

/** Envía la notificación a los dispositivos que correspondan según audiencia. No lanza - los
 *  errores de envío no deben tumbar la creación/publicación de la notificación que la llama. */
export async function sendPushForNotification(notification) {
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) return; // Admin SDK no configurado (ej. dev local sin .env) - no-op silencioso

    const where = buildTokenWhere(notification.audience);
    if (!where) return; // audiencia admin/permission:X - fuera de alcance v1

    const prisma = getPrismaClient();
    const tokens = await prisma.platformMobilePushToken.findMany({ where, select: { id: true, token: true } });
    if (!tokens.length) return;

    const message = {
      notification: { title: notification.title, body: notification.body || undefined },
      data: {
        notificationId: String(notification.id),
        notificationType: notification.type,
        ...(notification.href ? { href: notification.href } : {}),
      },
      android: { priority: "high", notification: { channelId: "default" } },
    };

    for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
      const batch = tokens.slice(i, i + MAX_TOKENS_PER_BATCH);
      const response = await messaging.sendEachForMulticast({ tokens: batch.map((item) => item.token), ...message });

      const disableIds = [];
      response.responses.forEach((result, index) => {
        if (!result.success && DISABLE_ON_ERROR_CODES.has(result.error?.code)) {
          disableIds.push(batch[index].id);
        }
      });

      if (disableIds.length) {
        await prisma.platformMobilePushToken.updateMany({ where: { id: { in: disableIds } }, data: { disabledAt: new Date() } });
      }
    }
  } catch (error) {
    console.error("No se pudo enviar push para la notificación:", notification.id, error);
  }
}

/**
 * Claim atómico sobre pushedAt (mismo patrón que publishedAt): la primera vez que una notificación
 * se publica de verdad, dispara el push; si ya se pusheó antes (edición, reactivación), no repite.
 * Se llama solo desde los puntos que representan "esto se acaba de publicar por primera vez", nunca
 * desde activar/desactivar/borrar/restaurar - ver plan para el porqué.
 */
export async function notifyDevicesForNewlyPublished(notification) {
  const prisma = getPrismaClient();
  const claimed = await prisma.platformNotification.updateMany({
    where: { id: notification.id, pushedAt: null },
    data: { pushedAt: new Date() },
  });
  if (!claimed.count) return;

  await sendPushForNotification(notification);
}
