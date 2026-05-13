"use client";

import { ArrowUpDown } from "lucide-react";

export default function MaintainerTable({
  ariaLabel,
  columns = [],
  sortConfig = null,
  onSort,
  isLoading = false,
  loadingText = "Cargando...",
  isEmpty = false,
  emptyText = "No hay registros.",
  children,
  pagination = null,
  className = "",
}) {
  return (
    <main className={`maintainer-table-shell ${className}`.trim()}>
      <div className="maintainer-table" role="table" aria-label={ariaLabel}>
        <div className="maintainer-table-row maintainer-table-head" role="row">
          {columns.map((column) => (
            column.sortable ? (
              <button key={column.key} type="button" className="maintainer-table-sort" onClick={() => onSort?.(column.key)}>
                {column.label}
                <ArrowUpDown size={14} aria-hidden="true" />
              </button>
            ) : (
              <span key={column.key}>{column.label}</span>
            )
          ))}
        </div>
        {isLoading ? (
          <div className="empty-state">
            <div className="empty-state-icon">AD</div>
            <div className="empty-state-text">{loadingText}</div>
          </div>
        ) : isEmpty ? (
          <div className="empty-state">
            <div className="empty-state-icon">AD</div>
            <div className="empty-state-text">{emptyText}</div>
          </div>
        ) : children}
      </div>
      {pagination ? (
        <div className="maintainer-pagination" aria-label="Paginación">
          <span>{pagination.from}-{pagination.to} de {pagination.total}</span>
          <div>
            <button type="button" onClick={pagination.onPrevious} disabled={!pagination.canPrevious}>Anterior</button>
            <button type="button" onClick={pagination.onNext} disabled={!pagination.canNext}>Siguiente</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
