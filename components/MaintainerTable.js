"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { FilterSelect } from "@/components/FiltersBar";

function getSortIcon(columnKey, sortConfig) {
  if (sortConfig?.key !== columnKey) {
    return <ArrowUpDown size={14} aria-hidden="true" />;
  }

  if (sortConfig.direction === "asc") {
    return <ArrowUp size={14} aria-hidden="true" />;
  }

  return <ArrowDown size={14} aria-hidden="true" />;
}

function getSortAriaLabel(column, sortConfig) {
  if (sortConfig?.key !== column.key) {
    return `Ordenar por ${column.label}`;
  }

  return sortConfig.direction === "asc"
    ? `${column.label}: orden ascendente. Cambiar a descendente`
    : `${column.label}: orden descendente. Cambiar a ascendente`;
}

function getAriaSort(columnKey, sortConfig) {
  if (sortConfig?.key !== columnKey) {
    return "none";
  }

  return sortConfig.direction === "asc" ? "ascending" : "descending";
}

function getPageSizeSelectId(ariaLabel) {
  const source = ariaLabel || "maintainer";
  const slug = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "maintainer"}-page-size`;
}

function getPageSizeOptions(pagination) {
  const baseOptions = pagination.pageSizeOptions || [10, 25, 50, 100];
  const optionValues = new Set(baseOptions.map((size) => Number(size)));
  const options = baseOptions.map((size) => ({
    value: String(size),
    label: String(size),
  }));

  if (pagination.pageSize && !optionValues.has(Number(pagination.pageSize)) && Number(pagination.pageSize) !== Number(pagination.total)) {
    options.push({
      value: String(pagination.pageSize),
      label: String(pagination.pageSize),
    });
  }

  if (pagination.total > 0) {
    options.push({ value: "all", label: "Todos" });
  }

  return options;
}

function getSelectedPageSizeValue(pagination) {
  const baseOptions = pagination.pageSizeOptions || [10, 25, 50, 100];
  const baseValues = new Set(baseOptions.map((size) => Number(size)));

  if (pagination.total > 0 && Number(pagination.pageSize) === Number(pagination.total) && !baseValues.has(Number(pagination.pageSize))) {
    return "all";
  }

  return String(pagination.pageSize);
}

function getNextPageSize(nextPageSize, pagination) {
  if (nextPageSize === "all") {
    return Math.max(1, Number(pagination.total) || 1);
  }

  return Number(nextPageSize);
}

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
  const scrollRef = useRef(null);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      setHasHorizontalOverflow(false);
      return undefined;
    }

    const tableElement = scrollElement.querySelector(".maintainer-table");

    const updateOverflow = () => {
      setHasHorizontalOverflow(scrollElement.scrollWidth > scrollElement.clientWidth + 1);
    };

    updateOverflow();

    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(scrollElement);

    if (tableElement) {
      resizeObserver.observe(tableElement);
    }

    window.addEventListener("resize", updateOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [columns.length, children, isEmpty, isLoading]);

  return (
    <main className={`maintainer-table-shell ${className}`.trim()}>
      <div className="maintainer-table-scroll" ref={scrollRef}>
        {hasHorizontalOverflow ? (
          <div className="maintainer-scroll-hint" aria-hidden="true">
            Desliza horizontalmente para ver más columnas
          </div>
        ) : null}
        <div className="maintainer-table" role="table" aria-label={ariaLabel}>
          <div className="maintainer-table-row maintainer-table-head" role="row">
            {columns.map((column) => (
              column.sortable ? (
                <button
                  key={column.key}
                  type="button"
                  className={`maintainer-table-sort ${sortConfig?.key === column.key ? "is-active" : ""}`.trim()}
                  aria-label={getSortAriaLabel(column, sortConfig)}
                  aria-sort={getAriaSort(column.key, sortConfig)}
                  onClick={() => onSort?.(column.key)}
                >
                  {column.label}
                  {getSortIcon(column.key, sortConfig)}
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
      </div>
      {pagination ? (
        <div className="maintainer-pagination" aria-label="Paginación">
          <span>{pagination.from}-{pagination.to} de {pagination.total}</span>
          {pagination.pageSize && pagination.onPageSizeChange ? (
            <div className="maintainer-page-size">
              <FilterSelect
                id={getPageSizeSelectId(ariaLabel)}
                label="Filas"
                value={getSelectedPageSizeValue(pagination)}
                options={getPageSizeOptions(pagination)}
                onChange={(nextPageSize) => pagination.onPageSizeChange(getNextPageSize(nextPageSize, pagination))}
              />
            </div>
          ) : null}
          <div className="maintainer-pagination-actions">
            <button type="button" onClick={pagination.onPrevious} disabled={!pagination.canPrevious}>Anterior</button>
            <button type="button" onClick={pagination.onNext} disabled={!pagination.canNext}>Siguiente</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
