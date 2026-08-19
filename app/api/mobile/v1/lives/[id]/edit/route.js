import { jsonError, readJsonRequest } from "@/lib/http";
import { getMobileAccessUser } from "@/lib/mobileAuth";
import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { getLiveById, getLiveStatuses, upsertLive } from "@/lib/repositories/liveRepository";
import { canAny } from "@/lib/repositories/platformUserRepository";
import { getTrackerValidationMessage, trackerLivePayloadSchema } from "@/lib/trackerValidation";

export const dynamic = "force-dynamic";

// Ruta dedicada en vez de reusar app/api/update/route.js: esa multiplexa 5 acciones por auth de
// cookie de sesión - acá alcanza con un solo propósito (editar campos "compactos", sin imagen,
// ver plan) autenticado por Bearer. Reusa trackerLivePayloadSchema/upsertLive tal cual - mismo
// contrato que ya valida/persiste la web, así que un edit desde mobile es indistinguible de uno
// hecho desde el admin de la web.
export async function PUT(request, { params }) {
  const user = await getMobileAccessUser(request);
  if (!canAny(user, ["tracker.update"])) {
    return jsonError("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const liveId = Number(id);
  if (!Number.isInteger(liveId)) {
    return jsonError("ID inválido.", { status: 400 });
  }

  const before = await getLiveById(liveId);
  if (!before) {
    return jsonError("Directo no encontrado.", { status: 404 });
  }

  const payload = await readJsonRequest(request);
  if (!payload?.live) {
    return jsonError("Solicitud inválida.", { status: 400 });
  }

  // El formulario mobile no edita imagen (ver plan - evita sumar expo-image-picker/rebuild nativo
  // en esta pasada), así que se preserva tal cual venía para no pisarla con "".
  const candidate = { ...payload.live, id: before.id, image: before.image };
  const validation = trackerLivePayloadSchema.safeParse(candidate);

  if (!validation.success) {
    return jsonError(getTrackerValidationMessage(validation.error), { status: 400 });
  }

  const [sortedLives, statuses] = await Promise.all([
    upsertLive(validation.data),
    getLiveStatuses(),
  ]);
  const savedLive = sortedLives.find((live) => live.id === validation.data.id) || validation.data;

  await createAuditLog({
    actor: user,
    action: "update",
    module: "admin.tracker",
    entityType: "Live",
    entityId: savedLive.id,
    entityLabel: savedLive.title,
    summary: "Editó directo (mobile)",
    before,
    after: savedLive,
    request,
  });

  return Response.json({ success: true, live: savedLive, statuses });
}
