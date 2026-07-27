"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, History, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const ACTION_LABELS = {
  activate: "Activación",
  create: "Creación",
  deactivate: "Desactivación",
  delete: "Eliminación",
  permission_change: "Permisos",
  replace: "Reemplazo",
  restore: "Restauración",
  soft_delete: "Eliminación",
  status_change: "Cambio de estado",
  update: "Edición",
};

function formatDate(value) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getActorLabel(log) {
  return log.actorAlias || log.actorUsername || (log.actorUserId ? `Usuario #${log.actorUserId}` : "Sistema");
}

function formatJson(value) {
  if (value == null) {
    return "Sin datos";
  }

  return JSON.stringify(value, null, 2);
}

export default function AuditLogModal({
  isOpen,
  module,
  title = "Historial",
  subtitle = "Últimas acciones registradas.",
  onClose,
}) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (module) params.set("module", module);
    return params.toString();
  }, [module]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedLog(null);
      return undefined;
    }

    let isMounted = true;

    async function loadLogs() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/audit-logs?${query}`, { cache: "no-store" });
        const data = await response.json();

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || "No se pudo cargar el historial.");
        }

        if (isMounted) {
          setLogs(data.logs || []);
        }
      } catch (error) {
        toast.error(error.message || "No se pudo cargar el historial.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, query]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop confirm-backdrop">
      <section className="modal-content audit-modal" aria-modal="true" role="dialog" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close-button" aria-label="Cerrar historial" onClick={onClose}>
          <X size={18} />
        </button>
        <header className="audit-modal-header">
          <span className="tracker-actions-label">Auditoría</span>
          <h2 className="modal-title">{title}</h2>
          <p>{subtitle}</p>
        </header>

        <div className="audit-modal-body">
          <div className="audit-log-list" aria-label="Registros de auditoría">
            {isLoading ? (
              <div className="audit-log-empty">
                <Loader2 className="spin" size={18} />
                Cargando historial...
              </div>
            ) : logs.length ? (
              logs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  className={`audit-log-item ${selectedLog?.id === log.id ? "is-active" : ""}`}
                  onClick={() => setSelectedLog(log)}
                >
                  <span className="audit-log-icon"><History size={15} /></span>
                  <span>
                    <strong>{log.summary || ACTION_LABELS[log.action] || log.action}</strong>
                    <small>{getActorLabel(log)} · {log.entityLabel || log.entityId || log.entityType}</small>
                  </span>
                  <em><Clock size={13} /> {formatDate(log.createdAt)}</em>
                </button>
              ))
            ) : (
              <div className="audit-log-empty">No hay acciones registradas para este mantenedor.</div>
            )}
          </div>

          <aside className="audit-log-detail">
            {selectedLog ? (
              <>
                <div className="audit-detail-summary">
                  <span>{ACTION_LABELS[selectedLog.action] || selectedLog.action}</span>
                  <h3>{selectedLog.entityLabel || selectedLog.entityId || selectedLog.entityType}</h3>
                  <p>{selectedLog.summary}</p>
                </div>
                <dl className="audit-detail-meta">
                  <div><dt>Usuario</dt><dd>{getActorLabel(selectedLog)}</dd></div>
                  <div><dt>Fecha</dt><dd>{formatDate(selectedLog.createdAt)}</dd></div>
                  <div><dt>Módulo</dt><dd>{selectedLog.module}</dd></div>
                  <div><dt>Registro</dt><dd>{selectedLog.entityType} {selectedLog.entityId ? `#${selectedLog.entityId}` : ""}</dd></div>
                  {selectedLog.ipAddress ? <div><dt>IP</dt><dd>{selectedLog.ipAddress}</dd></div> : null}
                </dl>
                <div className="audit-diff-grid">
                  <div>
                    <strong>Antes</strong>
                    <pre>{formatJson(selectedLog.before)}</pre>
                  </div>
                  <div>
                    <strong>Después</strong>
                    <pre>{formatJson(selectedLog.after)}</pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="audit-log-empty">Selecciona un registro para ver el detalle.</div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
