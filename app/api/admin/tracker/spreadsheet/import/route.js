import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/repositories/auditLogRepository";
import { bulkUpdateLives, getLiveStatuses, readLives } from "@/lib/repositories/liveRepository";
import { ensurePermissionAuthorized } from "@/lib/serverAuth";
import { analyzeTrackerWorkbook } from "@/lib/trackerSpreadsheet";

export const dynamic = "force-dynamic";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function publicAnalysis(analysis) {
  return {
    errors: analysis.errors,
    conflicts: analysis.conflicts,
    newRows: analysis.newRows,
    warnings: analysis.warnings,
    unchanged: analysis.unchanged,
    changes: analysis.changes.map(({ live, ...change }) => change),
  };
}

export async function POST(request) {
  const authorization = await ensurePermissionAuthorized(request, "tracker.import");
  if (authorization.response) return authorization.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const action = String(formData.get("action") || "preview");
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: "Selecciona un archivo XLSX." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ success: false, error: "El archivo debe tener extensión .xlsx." }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ success: false, error: "El archivo no puede superar 10 MB." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const [before, statuses] = await Promise.all([readLives(), getLiveStatuses()]);
    const analysis = await analyzeTrackerWorkbook(buffer, before, statuses);
    const hasBlockingIssues = analysis.errors.length || analysis.conflicts.length || analysis.newRows.length;
    if (action === "preview") return NextResponse.json({ success: true, analysis: publicAnalysis(analysis), canApply: !hasBlockingIssues && analysis.changes.length > 0 });
    if (action !== "apply") return NextResponse.json({ success: false, error: "Acción no soportada." }, { status: 400 });
    if (hasBlockingIssues) return NextResponse.json({ success: false, error: "El archivo contiene errores, conflictos o filas nuevas. Corrígelos antes de importar.", analysis: publicAnalysis(analysis) }, { status: 409 });
    if (!analysis.changes.length) return NextResponse.json({ success: false, error: "El archivo no contiene cambios." }, { status: 400 });

    const lives = await bulkUpdateLives(analysis.changes.map((change) => change.live));
    await createAuditLog({
      actor: authorization.user,
      action: "spreadsheet_import",
      module: "admin.tracker",
      entityType: "Live",
      entityId: "bulk",
      entityLabel: file.name,
      summary: `Importó ${analysis.changes.length} registros desde Excel`,
      before: { count: analysis.changes.length, ids: analysis.changes.map((change) => change.internalId) },
      after: { count: analysis.changes.length, fieldsChanged: analysis.changes.reduce((total, change) => total + change.diffs.length, 0) },
      request,
    });
    return NextResponse.json({ success: true, lives, result: { updated: analysis.changes.length, fieldsChanged: analysis.changes.reduce((total, change) => total + change.diffs.length, 0), warnings: analysis.warnings.length } });
  } catch (error) {
    const isTransactionTimeout = error?.code === "P2028" || String(error?.message || "").includes("expired transaction");
    return NextResponse.json({
      success: false,
      error: isTransactionTimeout
        ? "La importación superó el tiempo disponible para actualizar los registros. Vuelve a intentarlo; si se repite, divide el archivo en grupos más pequeños."
        : error?.message || "No se pudo procesar el archivo XLSX.",
    }, { status: 500 });
  }
}
