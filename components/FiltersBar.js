export default function FiltersBar({
  filters,
  years,
  statuses,
  selectedTag,
  onFiltersChange,
  onTagPanelOpen,
  onClearTag,
}) {
  return (
    <div id="controls-bar" className="controls-bar">
      <input
        type="search"
        id="search-input"
        className="search-input"
        placeholder="🔍 Buscar por titulo o etiquetas..."
        value={filters.search}
        onChange={(event) => onFiltersChange({ search: event.target.value })}
      />

      <div className="filter-group">
        <select
          id="filter-year"
          className="custom-select"
          value={filters.year}
          onChange={(event) => onFiltersChange({ year: event.target.value })}
        >
          <option value="all">Todos los Años</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          id="filter-status"
          className="custom-select"
          value={filters.status}
          onChange={(event) => onFiltersChange({ status: event.target.value })}
        >
          <option value="all">Todos los Estados</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

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
