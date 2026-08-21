import { NextResponse } from "next/server";

import { canAny } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";
import { getMobileAccessUser } from "@/lib/mobileAuth";

// Mismo gate de permisos que app/api/lives/route.js (versión web), solo que resuelto vía Bearer en
// vez de cookie de sesión - invitados caen a getPublicAccessUser(), igual que la web.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = await getMobileAccessUser(request);

  if (!canAny(user, ["tracker.view", "tracker.calendar.view"])) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const [lives, statuses] = await Promise.all([readLives(), getLiveStatuses()]);

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

  // Cache-Control explícito: "force-dynamic" evita el cacheo de Next.js en build/SSR, pero no manda
  // por sí solo un header que impida a un proxy/CDN intermedio (o al propio cliente) cachear esta
  // respuesta - esta lista cambia seguido (ediciones desde el admin), nunca debería servirse stale.
  return NextResponse.json(
    { success: true, lives, statuses, permissions },
    { headers: { "Cache-Control": "no-store" } },
  );
}
