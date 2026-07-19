"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useDropzone } from "react-dropzone";

import MaintainerModal from "@/components/MaintainerModal";

const STEPS = ["Archivo", "Revisión", "Confirmación", "Resultado"];

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join("\n") : "Vacío";
  if (value && typeof value === "object") return Object.entries(value).map(([key, items]) => `${key}: ${(items || []).join(" | ") || "Vacío"}`).join("\n");
  return String(value || "Vacío");
}

export default function TrackerSpreadsheetImportModal({ isOpen, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState("changes");
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    noClick: true,
    onDrop: (files) => {
      setFile(files[0] || null);
      setError(files[0] ? "" : "Selecciona un archivo XLSX válido.");
    },
    onDropRejected: () => setError("El archivo debe ser XLSX y no superar 10 MB."),
  });

  if (!isOpen) return null;

  function resetAndClose() {
    if (isLoading) return;
    setFile(null);
    setStep(0);
    setAnalysis(null);
    setResult(null);
    setError("");
    setConfirmed(false);
    setActiveTab("changes");
    onClose();
  }

  async function submit(action) {
    if (!file) {
      setError("Selecciona el archivo que deseas importar.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("action", action);
      const response = await fetch("/api/admin/tracker/spreadsheet/import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo procesar el archivo.");
      if (action === "preview") {
        setAnalysis({ ...data.analysis, canApply: data.canApply });
        setStep(1);
      } else {
        setResult(data.result);
        setStep(3);
        onImported?.(data.lives || []);
      }
    } catch (submitError) {
      setError(submitError.message || "No se pudo procesar el archivo.");
    } finally {
      setIsLoading(false);
    }
  }

  const tabs = [
    { key: "changes", label: "Cambios", count: analysis?.changes?.length || 0 },
    { key: "conflicts", label: "Conflictos", count: analysis?.conflicts?.length || 0 },
    { key: "errors", label: "Errores", count: analysis?.errors?.length || 0 },
    { key: "newRows", label: "Filas nuevas", count: analysis?.newRows?.length || 0 },
    { key: "warnings", label: "Advertencias", count: analysis?.warnings?.length || 0 },
  ];
  const activeItems = analysis?.[activeTab] || [];

  return (
    <MaintainerModal
      className="admin-modal tracker-spreadsheet-modal"
      title={step === 0 ? "Importar registros del Rastreador" : step === 1 ? "Revisar importación" : step === 2 ? "Confirmar actualización masiva" : "Importación completada"}
      subtitle={step === 0 ? "Actualiza registros existentes usando el mismo formato generado por la exportación." : file?.name || ""}
      closeOnBackdrop={false}
      onClose={resetAndClose}
    >
      <div className="tracker-import-steps" aria-label={`Paso ${step + 1} de 4`}>
        {STEPS.map((label, index) => <span key={label} className={index === step ? "is-active" : index < step ? "is-complete" : ""}>{index + 1}. {label}</span>)}
      </div>

      {step === 0 ? (
        <>
          <div {...getRootProps()} className={`tracker-import-dropzone ${isDragActive ? "is-dragging" : ""}`}>
            <input {...getInputProps()} />
            <FileSpreadsheet size={40} aria-hidden="true" />
            <strong>{file ? file.name : "Arrastra el Excel aquí"}</strong>
            <span>{file ? `${Math.ceil(file.size / 1024)} KB` : "Formato XLSX · máximo 10 MB"}</span>
            <button type="button" className="tracker-action-secondary" onClick={open}>Seleccionar archivo</button>
          </div>
          <p className="tracker-import-note"><AlertTriangle size={16} /> El archivo se analizará y comparará con la base antes de modificar registros.</p>
          {error ? <p className="field-error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn-modal btn-modal-secondary" onClick={resetAndClose}>Cancelar</button>
            <button type="button" className="btn-modal btn-modal-primary" onClick={() => submit("preview")} disabled={!file || isLoading}>{isLoading ? "Analizando..." : "Analizar archivo"}</button>
          </div>
        </>
      ) : null}

      {step === 1 && analysis ? (
        <>
          <div className="tracker-import-summary">
            <span><strong>{analysis.changes.length}</strong> con cambios</span>
            <span><strong>{analysis.unchanged}</strong> sin cambios</span>
            <span className={analysis.conflicts.length ? "is-danger" : ""}><strong>{analysis.conflicts.length}</strong> conflictos</span>
            <span className={analysis.errors.length ? "is-danger" : ""}><strong>{analysis.errors.length}</strong> errores</span>
            <span className={analysis.newRows.length ? "is-warning" : ""}><strong>{analysis.newRows.length}</strong> filas nuevas</span>
          </div>
          <div className="tracker-import-tabs">
            {tabs.map((tab) => <button type="button" key={tab.key} className={activeTab === tab.key ? "is-active" : ""} onClick={() => setActiveTab(tab.key)}>{tab.label} ({tab.count})</button>)}
          </div>
          <div className="tracker-import-review-list">
            {!activeItems.length ? <p className="tracker-import-empty">No hay elementos en esta categoría.</p> : null}
            {activeItems.map((item, index) => (
              <article key={`${activeTab}-${item.row}-${index}`} className="tracker-import-review-item">
                <header><strong>Fila {item.row}{item.dbId ? ` · #${item.dbId}` : ""}</strong><span>{item.internalId || item.title || ""}</span></header>
                {item.message ? <p>{item.message}</p> : null}
                {item.diffs?.map((diff) => (
                  <div className="tracker-import-diff" key={diff.field}>
                    <strong>{diff.field}</strong>
                    <span><small>Actual</small>{formatValue(diff.before)}</span>
                    <span><small>Excel</small>{formatValue(diff.after)}</span>
                  </div>
                ))}
              </article>
            ))}
          </div>
          {error ? <p className="field-error">{error}</p> : null}
          <p className="tracker-import-status">{analysis.canApply ? "La revisión no encontró problemas bloqueantes." : "Corrige los errores, conflictos o filas nuevas para continuar."}</p>
          <div className="modal-actions">
            <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setStep(0)}>Volver</button>
            <button type="button" className="btn-modal btn-modal-primary" disabled={!analysis.canApply} onClick={() => setStep(2)}>Continuar con {analysis.changes.length} cambios</button>
          </div>
        </>
      ) : null}

      {step === 2 && analysis ? (
        <>
          <div className="tracker-import-confirmation">
            <AlertTriangle size={34} />
            <h3>Se actualizarán {analysis.changes.length} registros</h3>
            <p>La operación sincronizará todos los campos editables del Excel. Si una celda opcional está vacía, su valor actual será eliminado.</p>
            <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo que revisé los cambios y deseo actualizar los datos.</label>
          </div>
          {error ? <p className="field-error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setStep(1)} disabled={isLoading}>Volver a revisar</button>
            <button type="button" className="btn-modal btn-modal-danger" onClick={() => submit("apply")} disabled={!confirmed || isLoading}>{isLoading ? "Actualizando..." : `Actualizar ${analysis.changes.length} registros`}</button>
          </div>
        </>
      ) : null}

      {step === 3 && result ? (
        <>
          <div className="tracker-import-result">
            <CheckCircle2 size={48} />
            <h3>{result.updated} registros actualizados</h3>
            <p>{result.fieldsChanged} campos modificados · {result.warnings} advertencias</p>
          </div>
          <div className="modal-actions"><button type="button" className="btn-modal btn-modal-primary" onClick={resetAndClose}><Upload size={16} /> Cerrar y ver registros</button></div>
        </>
      ) : null}
    </MaintainerModal>
  );
}
