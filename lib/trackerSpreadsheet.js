import crypto from "node:crypto";

import ExcelJS from "exceljs";

import { normalizeLive } from "./lives.js";
import { buildLinkDiagnostics } from "./trackerLinkDiagnostics.js";
import { trackerLivePayloadSchema } from "./trackerValidation.js";

export const TRACKER_SPREADSHEET_VERSION = "1.0";
export const TRACKER_SPREADSHEET_MAX_ROWS = 5000;

const HEADERS = [
  "ID_BD",
  "ID_INTERNO",
  "FECHA",
  "TITULO",
  "AÑO",
  "ESTADO",
  "OKRU",
  "TELEGRAM",
  "PATREON",
  "PIERO",
  "TAGS",
  "IMAGEN",
  "INFORMACION_ADICIONAL",
  "DIAGNOSTICO",
  "VERSION_ORIGEN",
];

const EDITABLE_COLUMNS = new Set(["FECHA", "TITULO", "AÑO", "ESTADO", "OKRU", "TELEGRAM", "PATREON", "PIERO", "TAGS", "IMAGEN", "INFORMACION_ADICIONAL"]);
const LINK_PLATFORMS = ["okru", "telegram", "patreon", "piero"];

function cleanString(value) {
  if (value == null) return "";
  if (typeof value === "object" && value.text) return String(value.text).trim();
  if (typeof value === "object" && value.result != null) return String(value.result).trim();
  return String(value).trim();
}

function splitMultiline(value) {
  return cleanString(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatExcelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
  }

  const text = cleanString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  }
  return text;
}

function toExcelDate(value) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function normalizedSnapshot(live) {
  const source = normalizeLive(live);
  return {
    dbId: live?.dbId == null ? null : Number(live.dbId),
    id: source.id,
    date: source.date,
    title: source.title,
    year: source.year,
    status: source.status,
    links: Object.fromEntries(LINK_PLATFORMS.map((platform) => [platform, source.links[platform] || []])),
    tags: source.tags || [],
    image: source.image || "",
    additional_info: source.additional_info || "",
  };
}

export function getLiveSpreadsheetVersion(live) {
  return crypto.createHash("sha256").update(JSON.stringify(normalizedSnapshot(live))).digest("hex").slice(0, 24);
}

export async function createTrackerWorkbook(lives, statuses = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lolweapon Resubidos";
  workbook.created = new Date();
  workbook.modified = new Date();

  const instructions = workbook.addWorksheet("Instrucciones", { properties: { tabColor: { argb: "FF8B5CF6" } } });
  instructions.columns = [{ width: 28 }, { width: 105 }];
  instructions.addRows([
    ["Importación Rastreador", "Edita los campos de la hoja Registros y vuelve a importar el mismo archivo desde el mantenedor."],
    ["Identificadores", "ID_BD e ID_INTERNO no deben modificarse. El servidor los valida aunque Excel permita alterar la protección."],
    ["Enlaces", "Escribe un enlace por línea dentro de OKRU, TELEGRAM, PATREON y PIERO. Una celda vacía elimina los enlaces de esa plataforma."],
    ["Tags", "Escribe un tag por línea. Una celda vacía elimina todos los tags del registro."],
    ["Filas nuevas", "La creación desde Excel todavía no está disponible. Las filas sin identificadores se reportarán y no se importarán."],
    ["Versión", TRACKER_SPREADSHEET_VERSION],
  ]);
  instructions.getRow(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  instructions.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
  instructions.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });

  const diagnostics = buildLinkDiagnostics(lives);
  const sheet = workbook.addWorksheet("Registros", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { key: "dbId", width: 12 }, { key: "id", width: 26 }, { key: "date", width: 14 }, { key: "title", width: 52 },
    { key: "year", width: 10 }, { key: "status", width: 24 }, { key: "okru", width: 48 }, { key: "telegram", width: 48 },
    { key: "patreon", width: 42 }, { key: "piero", width: 42 }, { key: "tags", width: 36 }, { key: "image", width: 42 },
    { key: "additional", width: 58 }, { key: "diagnostic", width: 44 }, { key: "version", width: 12, hidden: true },
  ];
  sheet.addRow(HEADERS);
  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82B6" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  for (const live of lives) {
    const row = sheet.addRow([
      live.dbId || "", live.id, toExcelDate(live.date), live.title, Number(live.year) || live.year, live.status,
      (live.links?.okru || []).join("\n"), (live.links?.telegram || []).join("\n"), (live.links?.patreon || []).join("\n"),
      (live.links?.piero || []).join("\n"), (live.tags || []).join("\n"), live.image || "", live.additional_info || "",
      (diagnostics.get(live.id) || []).join("\n"), getLiveSpreadsheetVersion(live),
    ]);
    row.height = 42;
    row.eachCell((cell, columnNumber) => {
      const header = HEADERS[columnNumber - 1];
      cell.alignment = { vertical: "top", wrapText: true };
      cell.protection = { locked: !EDITABLE_COLUMNS.has(header) };
      if (!EDITABLE_COLUMNS.has(header)) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    });
    row.getCell(3).numFmt = "yyyy-mm-dd";
  }
  sheet.autoFilter = { from: "A1", to: `N${Math.max(1, sheet.rowCount)}` };
  if (statuses.length && sheet.rowCount > 1) {
    const labels = statuses.map((status) => status.label || status).filter(Boolean).join(",");
    if (labels.length <= 255) {
      for (let row = 2; row <= sheet.rowCount; row += 1) sheet.getCell(`F${row}`).dataValidation = { type: "list", allowBlank: false, formulae: [`"${labels.replaceAll('"', '""')}"`] };
    }
  }
  await sheet.protect("lolweapon-rastreador", { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, sort: true });
  return workbook;
}

function getFieldDiffs(before, after) {
  const fields = ["date", "title", "year", "status", "links", "tags", "image", "additional_info"];
  return fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])).map((field) => ({
    field,
    before: before[field],
    after: after[field],
  }));
}

function validationIssueTouchesChangedValue(issue, before, after) {
  const [field, nestedField] = issue.path || [];
  if (!field) return true;

  if (field === "links" && typeof nestedField === "string") {
    return JSON.stringify(before.links?.[nestedField] || []) !== JSON.stringify(after.links?.[nestedField] || []);
  }

  return JSON.stringify(before[field]) !== JSON.stringify(after[field]);
}

export async function analyzeTrackerWorkbook(buffer, currentLives, statuses = []) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Registros");
  if (!sheet) return { errors: [{ row: 0, message: "El archivo no contiene la hoja Registros." }], changes: [], unchanged: 0, conflicts: [], newRows: [], warnings: [] };
  if (sheet.rowCount - 1 > TRACKER_SPREADSHEET_MAX_ROWS) return { errors: [{ row: 0, message: `El archivo supera el máximo de ${TRACKER_SPREADSHEET_MAX_ROWS} filas.` }], changes: [], unchanged: 0, conflicts: [], newRows: [], warnings: [] };

  const actualHeaders = sheet.getRow(1).values.slice(1).map(cleanString);
  const missingHeaders = HEADERS.filter((header) => !actualHeaders.includes(header));
  if (missingHeaders.length) return { errors: [{ row: 1, message: `Faltan columnas obligatorias: ${missingHeaders.join(", ")}.` }], changes: [], unchanged: 0, conflicts: [], newRows: [], warnings: [] };
  const column = Object.fromEntries(actualHeaders.map((header, index) => [header, index + 1]));
  const byDbId = new Map(currentLives.filter((live) => live.dbId != null).map((live) => [Number(live.dbId), live]));
  const byInternalId = new Map(currentLives.map((live) => [live.id, live]));
  const allowedStatuses = new Set(statuses.map((status) => status.label || status).filter(Boolean));
  const usesDatabaseIds = byDbId.size > 0;
  const seenDbIds = new Set();
  const seenInternalIds = new Set();
  const result = { errors: [], changes: [], unchanged: 0, conflicts: [], newRows: [], warnings: [] };

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const dbIdText = cleanString(row.getCell(column.ID_BD).value);
    const internalId = cleanString(row.getCell(column.ID_INTERNO).value);
    if (!dbIdText && !internalId && !cleanString(row.getCell(column.TITULO).value)) continue;
    if (!internalId) {
      result.newRows.push({ row: rowNumber, title: cleanString(row.getCell(column.TITULO).value), message: "La creación de registros desde Excel todavía no está disponible." });
      continue;
    }
    if (!dbIdText && usesDatabaseIds) {
      result.newRows.push({ row: rowNumber, internalId, title: cleanString(row.getCell(column.TITULO).value), message: "La creación de registros desde Excel todavía no está disponible." });
      continue;
    }
    const dbId = dbIdText ? Number(dbIdText) : null;
    if (dbIdText && (!Number.isInteger(dbId) || dbId <= 0)) {
      result.errors.push({ row: rowNumber, message: "ID_BD no es válido." });
      continue;
    }
    if ((dbId != null && seenDbIds.has(dbId)) || seenInternalIds.has(internalId)) {
      result.errors.push({ row: rowNumber, message: "ID_BD o ID_INTERNO está repetido dentro del Excel." });
      continue;
    }
    if (dbId != null) seenDbIds.add(dbId);
    seenInternalIds.add(internalId);
    const current = (dbId != null ? byDbId.get(dbId) : null) || byInternalId.get(internalId);
    if (!current) {
      result.errors.push({ row: rowNumber, message: `No existe el registro ID_BD #${dbId}.` });
      continue;
    }
    if (current.id !== internalId || (current.dbId != null && Number(current.dbId) !== dbId)) {
      result.errors.push({ row: rowNumber, message: "ID_BD e ID_INTERNO no corresponden al mismo registro." });
      continue;
    }
    const exportedVersion = cleanString(row.getCell(column.VERSION_ORIGEN).value);
    if (exportedVersion !== getLiveSpreadsheetVersion(current)) {
      result.conflicts.push({ row: rowNumber, dbId, internalId, title: current.title, message: "El registro cambió después de exportar el archivo." });
      continue;
    }
    const candidate = normalizeLive({
      ...current,
      dbId,
      id: internalId,
      date: formatExcelDate(row.getCell(column.FECHA).value),
      title: cleanString(row.getCell(column.TITULO).value),
      year: cleanString(row.getCell(column["AÑO"]).value),
      status: cleanString(row.getCell(column.ESTADO).value),
      links: {
        okru: splitMultiline(row.getCell(column.OKRU).value), telegram: splitMultiline(row.getCell(column.TELEGRAM).value),
        patreon: splitMultiline(row.getCell(column.PATREON).value), piero: splitMultiline(row.getCell(column.PIERO).value),
      },
      tags: splitMultiline(row.getCell(column.TAGS).value),
      image: cleanString(row.getCell(column.IMAGEN).value),
      additional_info: cleanString(row.getCell(column.INFORMACION_ADICIONAL).value),
    });
    if (allowedStatuses.size && !allowedStatuses.has(candidate.status)) {
      result.errors.push({ row: rowNumber, dbId, internalId, message: `El estado ${candidate.status || "vacío"} no existe en el catálogo.` });
      continue;
    }
    const currentSnapshot = normalizedSnapshot(current);
    const candidateSnapshot = normalizedSnapshot(candidate);
    const candidateDiffs = getFieldDiffs(currentSnapshot, candidateSnapshot);
    if (!candidateDiffs.length) {
      result.unchanged += 1;
      continue;
    }
    const validation = trackerLivePayloadSchema.safeParse(candidate);
    if (!validation.success) {
      const blockingIssues = validation.error.issues.filter((issue) => (
        validationIssueTouchesChangedValue(issue, currentSnapshot, candidateSnapshot)
      ));
      if (blockingIssues.length) {
        result.errors.push({ row: rowNumber, dbId, internalId, message: blockingIssues[0]?.message || "La fila contiene datos inválidos." });
        continue;
      }

      const preservedMessages = [...new Set(validation.error.issues.map((issue) => issue.message))];
      result.warnings.push({
        row: rowNumber,
        internalId,
        message: `Se conservarán valores heredados fuera de las reglas actuales: ${preservedMessages.join(" · ")}`,
      });
    }
    const next = { ...(validation.success ? validation.data : candidate), dbId };
    const diffs = getFieldDiffs(normalizedSnapshot(current), normalizedSnapshot(next));
    result.changes.push({ row: rowNumber, dbId, internalId, title: current.title, diffs, live: next });
  }

  const proposedLives = currentLives.map((live) => result.changes.find((change) => change.internalId === live.id)?.live || live);
  const diagnostics = buildLinkDiagnostics(proposedLives);
  for (const change of result.changes) {
    const messages = diagnostics.get(change.internalId) || [];
    if (messages.some((message) => message.includes("duplicado") || message.includes("compartido"))) result.warnings.push({ row: change.row, internalId: change.internalId, message: messages.join(" · ") });
  }
  return result;
}
