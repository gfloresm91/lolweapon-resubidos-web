"use client";

import { useEffect, useRef, useState } from "react";

const MONTH_LABELS = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

export function FilterSelect({ id, label, value, options, onChange, disabled = false, disabledHint = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!selectRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function selectOption(nextValue) {
    if (disabled) {
      return;
    }

    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div ref={selectRef} className={`filter-select ${disabled ? "is-disabled" : ""}`} id={id}>
      <button
        type="button"
        className={`filter-select-button ${isOpen ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={disabled ? false : isOpen}
        disabled={disabled}
        title={disabledHint}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
      >
        <span className="filter-select-label">{label}</span>
        <strong>{selectedOption.label}</strong>
        <span className="filter-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen && !disabled ? (
        <div className="filter-select-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-select-option ${option.value === value ? "is-selected" : ""}`}
              role="option"
              aria-selected={option.value === value}
              onClick={() => selectOption(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FiltersBar({
  filters,
  years,
  months,
  statuses,
  selectedTag,
  onSearchChange,
  onFiltersChange,
  onTagPanelOpen,
  onClearTag,
}) {
  const yearOptions = [
    { value: "all", label: "Todos los años" },
    ...years.map((year) => ({ value: year, label: year })),
  ];
  const monthOptions = [
    { value: "all", label: "Todos los meses" },
    ...months.map((month) => ({ value: month, label: MONTH_LABELS[month] || month })),
  ];
  const statusOptions = [
    { value: "all", label: "Todos los estados" },
    ...statuses.map((status) => ({ value: status, label: status })),
  ];

  return (
    <div id="controls-bar" className="controls-bar">
      <input
        type="search"
        id="search-input"
        className="search-input"
        placeholder="🔍 Buscar por titulo o etiquetas..."
        value={filters.search}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <div className="filter-group">
        <FilterSelect
          id="filter-year"
          label="Año"
          value={filters.year}
          options={yearOptions}
          onChange={(year) => onFiltersChange({ year, month: "all" })}
        />

        <FilterSelect
          id="filter-month"
          label="Mes"
          value={filters.month}
          options={monthOptions}
          disabled={filters.year === "all"}
          disabledHint="Selecciona un año para filtrar por mes"
          onChange={(month) => onFiltersChange({ month })}
        />

        <FilterSelect
          id="filter-status"
          label="Estado"
          value={filters.status}
          options={statusOptions}
          onChange={(status) => onFiltersChange({ status })}
        />

        <button
          type="button"
          id="btn-tag-panel"
          className={`btn-tag-panel ${selectedTag ? "is-active" : ""}`}
          onClick={onTagPanelOpen}
        >
          <span className="btn-tag-panel-icon" aria-hidden="true">#</span>
          <span className="btn-tag-panel-label">{selectedTag ? `Tag: ${selectedTag}` : "Tags"}</span>
        </button>
      </div>

      {selectedTag ? (
        <button type="button" className="selected-tag-banner" onClick={onClearTag}>
          Filtrando por tag: <strong>{selectedTag}</strong> ✕
        </button>
      ) : null}
    </div>
  );
}
