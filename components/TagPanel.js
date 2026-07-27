"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import { buildTagGroups, TAG_CATEGORIES } from "@/lib/tags";

const TAGS_PREVIEW_LIMIT = 16;

export default function TagPanel({
  isOpen,
  tags,
  tagCounts = {},
  selectedTag,
  onClose,
  onSelectTag,
}) {
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState({});
  const [customCategories, setCustomCategories] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    async function loadTagSettings() {
      try {
        const response = await fetch("/api/tags", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "No se pudieron cargar las categorias.");
        }

        if (!isCancelled) {
          setCustomCategories(Array.isArray(data.categories) ? data.categories : []);
          setOverrides(data.overrides && typeof data.overrides === "object" ? data.overrides : {});
          setSettingsError("");
        }
      } catch (error) {
        if (!isCancelled) {
          setSettingsError(error.message || "No se pudieron cargar las categorias.");
        }
      }
    }

    loadTagSettings();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setExpandedGroups({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const availableTags = useMemo(() => {
    const uniqueTags = new Map();

    tags.forEach((tag) => {
      const trimmedTag = String(tag || "").trim();
      const normalizedTag = trimmedTag.toLocaleLowerCase("es");

      if (trimmedTag && !uniqueTags.has(normalizedTag)) {
        uniqueTags.set(normalizedTag, trimmedTag);
      }
    });

    return [...uniqueTags.values()];
  }, [tags]);

  const categories = useMemo(() => {
    const baseCategories = TAG_CATEGORIES.filter((category) => category.key !== "other");
    const otherCategory = TAG_CATEGORIES.find((category) => category.key === "other");
    return [...baseCategories, ...customCategories, otherCategory].filter(Boolean);
  }, [customCategories]);

  const groups = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    const filteredTags = availableTags.filter((tag) => tag.toLocaleLowerCase("es").includes(normalizedSearch));
    return buildTagGroups(filteredTags, overrides, categories);
  }, [availableTags, categories, overrides, search]);
  const popularTags = useMemo(() => {
    return [...availableTags]
      .sort((left, right) => (tagCounts[right] || 0) - (tagCounts[left] || 0) || left.localeCompare(right))
      .slice(0, 10);
  }, [availableTags, tagCounts]);
  const visibleTagCount = groups.reduce((total, group) => total + group.tags.length, 0);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <>
      <div id="tag-panel-overlay" className="tag-panel-overlay visible" onClick={onClose} />
      <aside
        id="tag-panel"
        className="tag-panel open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-panel-title"
      >
        <div className="tag-panel-header">
          <div>
            <span className="tag-panel-kicker">Filtro avanzado</span>
            <h2 className="tag-panel-title" id="tag-panel-title">Explorar tags</h2>
          </div>
          <button
            type="button"
            id="btn-close-tag-panel"
            className="tag-panel-close"
            aria-label="Cerrar panel de tags"
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="tag-panel-summary">
          {selectedTag ? (
            <div className="tag-panel-selected">
              <div>
                <span>Tag activo</span>
                <strong>{selectedTag}</strong>
              </div>
              <button type="button" onClick={() => onSelectTag("")}>
                Limpiar
              </button>
            </div>
          ) : (
            <div className="tag-panel-empty-selection">
              <span>Sin tag activo</span>
              <strong>{availableTags.length} tags disponibles</strong>
            </div>
          )}
        </div>
        <div className="tag-panel-search-wrapper">
          <Search className="tag-panel-search-icon" size={18} aria-hidden="true" />
          <input
            type="search"
            id="tag-panel-search"
            className="tag-panel-search"
            placeholder="Buscar tag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="tag-panel-search-clear"
              aria-label="Limpiar búsqueda"
              onClick={() => setSearch("")}
            >
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div id="tag-panel-body" className="tag-panel-body">
          {settingsError ? <p className="tag-settings-error">{settingsError}</p> : null}

          {!search && popularTags.length ? (
            <section className="tag-popular-section">
              <div className="tag-popular-heading">
                <span>Tags con más directos</span>
                <small>Según registros del archivo</small>
              </div>
              <div className="tag-popular-list">
                {popularTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-popular-chip ${selectedTag === tag ? "is-active" : ""}`}
                    onClick={() => {
                      onSelectTag(tag);
                      onClose();
                    }}
                  >
                    <span>{tag}</span>
                    <strong>{tagCounts[tag] || 0}</strong>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {groups.map((group) => (
            <section
              key={group.key}
              className={`tag-category ${collapsed[group.key] ? "collapsed" : ""}`}
            >
              <button
                type="button"
                className="tag-category-header"
                onClick={() =>
                  setCollapsed((current) => ({
                    ...current,
                    [group.key]: !current[group.key],
                  }))
                }
              >
                <div className="tag-category-label">
                  <span>{group.icon}</span>
                  <span>{group.label}</span>
                </div>
                <div className="tag-category-header-right">
                  <span className="tag-category-count">{group.tags.length}</span>
                  <span className="tag-category-chevron">⌄</span>
                </div>
              </button>

              <div className="tag-category-tags">
                {(search || expandedGroups[group.key] ? group.tags : group.tags.slice(0, TAGS_PREVIEW_LIMIT)).map((tag) => {
                  const isActive = selectedTag === tag;

                  return (
                    <div
                      key={tag}
                      className={`tag-pill-sidebar ${isActive ? "active-tag" : ""}`}
                    >
                      <button
                        type="button"
                        className="tag-text-button"
                        onClick={() => {
                          onSelectTag(tag);
                          onClose();
                        }}
                      >
                        {tag}
                        <span>{tagCounts[tag] || 0}</span>
                      </button>

                    </div>
                  );
                })}
                {!search && group.tags.length > TAGS_PREVIEW_LIMIT ? (
                  <button
                    type="button"
                    className="tag-category-more"
                    onClick={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        [group.key]: !current[group.key],
                      }))
                    }
                  >
                    {expandedGroups[group.key] ? "Ver menos" : `Ver todos (${group.tags.length})`}
                  </button>
                ) : null}
              </div>
            </section>
          ))}

          {!visibleTagCount ? (
            <div className="tag-panel-no-results">
              <strong>Sin coincidencias</strong>
              <span>Prueba con otro texto o limpia la búsqueda.</span>
              <button type="button" onClick={() => setSearch("")}>
                Limpiar búsqueda
              </button>
            </div>
          ) : null}

        </div>
      </aside>
    </>,
    document.body
  );
}
