import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { readLives, getLiveStatuses } from "@/lib/repositories/liveRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { createTrackerWorkbook } from "@/lib/trackerSpreadsheet";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "tracker.export");
  if (authorization.response) return authorization.response;

  const payload = await readJsonRequest(request);
  const ids = Array.isArray(payload?.ids) ? payload.ids.map(String) : [];
  if (!ids.length) return NextResponse.json({ success: false, error: "No hay registros para exportar." }, { status: 400 });
  if (ids.length > 5000) return NextResponse.json({ success: false, error: "La exportación supera el máximo de 5000 registros." }, { status: 400 });

  const [lives, statuses] = await Promise.all([readLives(), getLiveStatuses()]);
  const byId = new Map(lives.map((live) => [live.id, live]));
  const selected = ids.map((id) => byId.get(id)).filter(Boolean);
  if (selected.length !== ids.length) return NextResponse.json({ success: false, error: "Uno o más registros ya no existen. Actualiza la página e inténtalo nuevamente." }, { status: 409 });

  const workbook = await createTrackerWorkbook(selected, statuses);
  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rastreador-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

