"use client";

import { Search } from "lucide-react";

export default function MaintainerToolbar({ searchId, searchValue, searchPlaceholder, onSearchChange, children }) {
  return (
    <section className="maintainer-toolbar" aria-label="Filtros">
      <input
        id={searchId}
        type="search"
        className="search-input maintainer-search-input"
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
      />
      <Search className="maintainer-search-icon" size={17} aria-hidden="true" />
      <div className="filter-group maintainer-filter-group">
        {children}
      </div>
    </section>
  );
}
