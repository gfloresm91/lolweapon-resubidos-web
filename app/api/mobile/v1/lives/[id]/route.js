import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getLiveById } from "@/lib/repositories/liveRepository";
import { getMobileAccessUser, getMobileUserIdFromRequest } from "@/lib/mobileAuth";
import { canAny } from "@/lib/repositories/platformUserRepository";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  const liveId = Number(id);
  if (!Number.isInteger(liveId)) {
    return jsonError("Id inválido.", { status: 400 });
  }

  const user = await getMobileAccessUser(request);
  if (!canAny(user, ["tracker.view", "tracker.calendar.view"])) {
    return jsonError("No autorizado", { status: 401 });
  }

  const live = await getLiveById(liveId);
  if (!live) {
    return jsonError("No encontrado.", { status: 404 });
  }

  // El merge de progreso vive acá, no dentro de getLiveById - esa función es genérica y también la
  // usa la web, no debe saber de userId mobile.
  const userId = await getMobileUserIdFromRequest(request);
  let playback = [];
  if (userId) {
    const prisma = getPrismaClient();
    playback = await prisma.platformUserLivePlayback.findMany({ where: { userId, liveId } });
  }

  // Mismo criterio que trackerFormVariant en HomePage.js/rastreador/[id]/page.js: tracker.update por
  // sí solo NO alcanza para editar - hace falta además tener uno de los dos permisos de variante de
  // formulario. Sin ninguno, la web ni siquiera ofrece el botón Editar.
  const formVariant = canAny(user, ["tracker.form.full"]) ? "full" : canAny(user, ["tracker.form.compact"]) ? "compact" : null;
  const permissions = {
    canSave: user?.id != null,
    canNotify: canAny(user, ["tracker.lives.notify", "admin.lives.notify"]),
    canEdit: canAny(user, ["tracker.update"]) && Boolean(formVariant),
    formVariant,
  };

  return NextResponse.json(
    { success: true, live, playback, permissions },
    { headers: { "Cache-Control": "no-store" } },
  );
}
