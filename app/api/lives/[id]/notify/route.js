import { createAuditLog, getAuditRequestMetadata } from "@/lib/repositories/auditLogRepository";
import { getLiveById } from "@/lib/repositories/liveRepository";
import { createResubidoNotification } from "@/lib/repositories/notificationRepository";
import { ensureAnyPermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const NOTIFY_PERMISSIONS = ["tracker.lives.notify", "admin.lives.notify"];

export async function POST(request, { params }) {
  const authorization = await ensureAnyPermissionAuthorized(request, NOTIFY_PERMISSIONS);
  if (authorization.response) {
    return authorization.response;
  }

  const { id } = await params;
  const liveId = Number(id);

  if (!Number.isFinite(liveId) || liveId <= 0) {
    return Response.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const live = await getLiveById(liveId);
    if (!live) {
      return Response.json({ error: "Directo no encontrado." }, { status: 404 });
    }

    const result = await createResubidoNotification({ live, actor: authorization.user });

    if (!result) {
      return Response.json({ error: "No se pudo enviar la notificación." }, { status: 503 });
    }

    await createAuditLog({
      actor: authorization.user,
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

    return Response.json({ error: "No se pudo enviar la notificación." }, { status: 500 });
  }
}
