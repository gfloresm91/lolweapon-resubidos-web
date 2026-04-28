"use client";

import { useEffect, useRef, useState } from "react";

function FilterSelect({ id, label, value, options, onChange }) {
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
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div ref={selectRef} className="filter-select" id={id}>
      <button
        type="button"
        className={`filter-select-button ${isOpen ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="filter-select-label">{label}</span>
        <strong>{selectedOption.label}</strong>
        <span className="filter-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen ? (
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
          onChange={(year) => onFiltersChange({ year })}
        />

        <FilterSelect
          id="filter-status"
          label="Estado"
          value={filters.status}
          options={statusOptions}
          onChange={(status) => onFiltersChange({ status })}
        />

        <button type="button" id="btn-tag-panel" className="btn-tag-panel" onClick={onTagPanelOpen}>
          🏷️ <span>Tags</span>
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
