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

  const permissions = {
    canSave: user?.id != null,
    canNotify: canAny(user, ["tracker.lives.notify", "admin.lives.notify"]),
    canEdit: canAny(user, ["tracker.update"]),
  };

  return NextResponse.json({ success: true, lives, statuses, permissions });
}
