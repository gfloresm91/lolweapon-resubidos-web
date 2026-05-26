"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, DownloadCloud, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import MaintainerStats from "@/components/MaintainerStats";

const EMPTY_SUMMARY = {
  languages: 0,
  chapters: 0,
  pages: 0,
  byLanguage: [],
};

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

function getLanguageLabel(language) {
  if (language === "es-es") return "Español";
  if (language === "en-us") return "English";
  return language || "Sin idioma";
}

export default function PlatformSpaceDrumImportPage({
  initialSummary = EMPTY_SUMMARY,
  canRun = false,
  onSummaryChange,
}) {
  const [summary, setSummary] = useState(initialSummary || EMPTY_SUMMARY);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const stats = useMemo(() => ({
    languages: summary?.languages || 0,
    chapters: summary?.chapters || 0,
    pages: summary?.pages || 0,
    byLanguage: Array.isArray(summary?.byLanguage) ? summary.byLanguage : [],
  }), [summary]);

  useEffect(() => {
    setSummary(initialSummary || EMPTY_SUMMARY);
  }, [initialSummary]);

  async function runImport() {
    setIsConfirmOpen(false);
    setIsImporting(true);

    try {
      const response = await fetch("/api/admin/spacedrum/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remote-import" }),
      });
      const data = await readJson(response);

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo importar SpaceDrum.");
      }

      setSummary(data.summary || EMPTY_SUMMARY);
      onSummaryChange?.(data.summary || EMPTY_SUMMARY);
      toast.success("SpaceDrum importado desde la web original.");
    } catch (error) {
      toast.error(error.message || "No se pudo importar SpaceDrum.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <>
      <header className="watching-header admin-users-header">
        <div className="header-badge">
          <span className="dot" />
          ADMINISTRACIÓN
        </div>
        <h1 className="title">
          SpaceDrum <span className="text-gradient">importación</span>
        </h1>
        <p className="subtitle">Sincroniza capítulos y páginas desde la web original de SpaceDrum cuando necesites refrescar la lectura.</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Idiomas", value: stats.languages, color: "purple" },
          { label: "Capítulos", value: stats.chapters, color: "green" },
          { label: "Páginas", value: stats.pages, color: "blue" },
          { label: "Origen", value: "Web", color: "orange", detail: "mangaspacedrum.com" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones de importación SpaceDrum">
        <div>
          <span className="tracker-actions-label">Importación remota</span>
          <p className="tracker-actions-copy">Descarga ambos idiomas, reconstruye capítulos y páginas, y registra la acción en auditoría.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
          <button
            type="button"
            className="tracker-action-primary"
            onClick={() => setIsConfirmOpen(true)}
            disabled={!canRun || isImporting}
          >
            {isImporting ? <RefreshCw size={17} className="spin-icon" /> : <DownloadCloud size={17} />}
            {isImporting ? "Importando..." : "Importar desde web"}
          </button>
        </div>
      </section>

      <section className="spacedrum-import-panel">
        <div className="spacedrum-import-card is-warning">
          <AlertTriangle size={20} />
          <div>
            <h2>Operación de reemplazo</h2>
            <p>
              La importación remota vuelve a escribir la biblioteca de SpaceDrum. Úsala cuando quieras refrescar el contenido desde la fuente original.
            </p>
          </div>
        </div>

        <div className="spacedrum-import-grid">
          {stats.byLanguage.length ? stats.byLanguage.map((item) => (
            <article className="spacedrum-import-card" key={item.language}>
              <span className="tracker-actions-label">{getLanguageLabel(item.language)}</span>
              <strong>{item.chapters} capítulos</strong>
              <p>{item.pages} páginas disponibles.</p>
            </article>
          )) : (
            <article className="spacedrum-import-card">
              <span className="tracker-actions-label">Sin datos</span>
              <strong>No hay resumen disponible</strong>
              <p>Ejecuta la importación para cargar el estado actual de SpaceDrum.</p>
            </article>
          )}
        </div>
      </section>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Importar SpaceDrum"
        description="Se descargará la información remota y se reemplazarán capítulos y páginas actuales. Esta acción quedará registrada en el historial."
        confirmLabel="Importar"
        cancelLabel="Cancelar"
        danger
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={runImport}
      />

      <AuditLogModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        module="admin.spacedrum.import"
        title="Historial de importación"
        subtitle="Últimas sincronizaciones remotas de SpaceDrum."
      />
    </>
  );
}
