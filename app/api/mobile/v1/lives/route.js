import { NextResponse } from "next/server";

import { canAny } from "@/lib/repositories/platformUserRepository";
import { getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";
import { getMobileAccessUser } from "@/lib/mobileAuth";

// La consulta del rastreador es pública, igual que su equivalente web. El bearer es opcional y
// solo habilita capacidades personales o administrativas en el objeto de permisos.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = await getMobileAccessUser(request);

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

  // El catálogo es público y comparte una caché CDN muy breve para absorber ráfagas de clientes
  // después de una invalidación en tiempo real. Las capacidades del usuario son pequeñas señales
  // derivadas del bearer, por lo que una respuesta autenticada no debe compartirse públicamente.
  const cacheControl = user?.id
    ? "private, no-store"
    : "public, max-age=0, s-maxage=10, stale-while-revalidate=20";
  return NextResponse.json(
    { success: true, lives, statuses, permissions },
    { headers: { "Cache-Control": cacheControl } },
  );
}
