import { jsonError } from "@/lib/http";
import { getMobileAccessUser } from "@/lib/mobileAuth";
import { createAuditLog, getAuditRequestMetadata } from "@/lib/repositories/auditLogRepository";
import { getLiveById } from "@/lib/repositories/liveRepository";
import { createResubidoNotification } from "@/lib/repositories/notificationRepository";
import { canAny } from "@/lib/repositories/platformUserRepository";

export const dynamic = "force-dynamic";

// Espejo exacto de app/api/lives/[id]/notify/route.js (staff/admin, avisa a TODOS los usuarios que
// el resubido está listo - no es "notificarme a mí"), solo cambia la autorización a Bearer.
const NOTIFY_PERMISSIONS = ["tracker.lives.notify", "admin.lives.notify"];

export async function POST(request, { params }) {
  const user = await getMobileAccessUser(request);
  if (!canAny(user, NOTIFY_PERMISSIONS)) {
    return jsonError("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const liveId = Number(id);

  if (!Number.isFinite(liveId) || liveId <= 0) {
    return jsonError("ID inválido.", { status: 400 });
  }

  try {
    const live = await getLiveById(liveId);
    if (!live) {
      return jsonError("Directo no encontrado.", { status: 404 });
    }

    const result = await createResubidoNotification({ live, actor: user });

    if (!result) {
      return jsonError("No se pudo enviar la notificación.", { status: 503 });
    }

    await createAuditLog({
      actor: user,
      action: "NOTIFY_RESUBIDO",
      module: "admin.tracker",
      entityType: "Live",
      entityId: liveId,
      entityLabel: live.title,
      summary: `Notificación de resubido enviada: "${live.title}"`,
      metadata: { notificationId: result.notification.id, ...getAuditRequestMetadata(request) },
    });

    return Response.json({ success: true, notifiedAt: result.notifiedAt });
  } catch (error) {
    if (error?.code === "RESUBIDO_NOTIFY_COOLDOWN") {
      return Response.json(
        { error: "Este resubido ya fue notificado hace unos segundos. Espera antes de reenviar." },
        { status: 429, headers: { "Retry-After": "10" } },
      );
    }

    return jsonError("No se pudo enviar la notificación.", { status: 500 });
  }
}
