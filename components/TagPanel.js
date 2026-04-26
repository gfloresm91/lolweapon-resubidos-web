"use client";

import { useEffect, useMemo, useState } from "react";

import { buildTagGroups, normalizeTag, TAG_CATEGORIES } from "@/lib/tags";

const DEFAULT_CATEGORY_ICON = "🏷️";

function normalizeCategorySlug(label) {
  return String(label || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCustomCategoryKey(label, existingCategories) {
  const baseKey = normalizeCategorySlug(label);
  const safeBaseKey = baseKey || "categoria";
  const existingKeys = new Set(existingCategories.map((category) => category.key));

  let key = `custom-${safeBaseKey}`;
  let index = 2;

  while (existingKeys.has(key)) {
    key = `custom-${safeBaseKey}-${index}`;
    index += 1;
  }

  return key;
}

export default function TagPanel({
  isOpen,
  tags,
  selectedTag,
  onClose,
  onSelectTag,
  isAdmin,
}) {
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState({});
  const [customCategories, setCustomCategories] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [moveDialog, setMoveDialog] = useState(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ label: "", icon: DEFAULT_CATEGORY_ICON });
  const [categoryError, setCategoryError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMoveDialog(null);
      setCategoryDialogOpen(false);
      setSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (categoryDialogOpen) {
          setCategoryDialogOpen(false);
          return;
        }

        if (moveDialog) {
          setMoveDialog(null);
          return;
        }

        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [categoryDialogOpen, isOpen, moveDialog, onClose]);

  const categories = useMemo(() => {
    const baseCategories = TAG_CATEGORIES.filter((category) => category.key !== "other");
    const otherCategory = TAG_CATEGORIES.find((category) => category.key === "other");
    return [...baseCategories, ...customCategories, otherCategory].filter(Boolean);
  }, [customCategories]);

  const groups = useMemo(() => {
    const filteredTags = tags.filter((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    return buildTagGroups(filteredTags, overrides, categories);
  }, [categories, overrides, search, tags]);

  async function persistTagSettings(nextSettings) {
    const nextCategories = nextSettings.categories ?? customCategories;
    const nextOverrides = nextSettings.overrides ?? overrides;
    const previousCategories = customCategories;
    const previousOverrides = overrides;

    setCustomCategories(nextCategories);
    setOverrides(nextOverrides);
    setIsSavingSettings(true);
    setSettingsError("");

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: nextCategories,
          overrides: nextOverrides,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron guardar las categorias.");
      }

      setCustomCategories(Array.isArray(data.categories) ? data.categories : nextCategories);
      setOverrides(data.overrides && typeof data.overrides === "object" ? data.overrides : nextOverrides);
      return true;
    } catch (error) {
      setCustomCategories(previousCategories);
      setOverrides(previousOverrides);
      setSettingsError(error.message || "No se pudieron guardar las categorias.");
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  }

  function openCategoryDialog() {
    setCategoryDraft({ label: "", icon: DEFAULT_CATEGORY_ICON });
    setCategoryError("");
    setCategoryDialogOpen(true);
  }

  async function createCategory(event) {
    event.preventDefault();

    const label = categoryDraft.label.trim();
    const icon = categoryDraft.icon.trim() || DEFAULT_CATEGORY_ICON;

    if (!label) {
      setCategoryError("Escribe un nombre para la categoria.");
      return;
    }

    const normalizedLabel = normalizeCategorySlug(label);
    const alreadyExists = categories.some((category) => normalizeCategorySlug(category.label) === normalizedLabel);

    if (alreadyExists) {
      setCategoryError("Ya existe una categoria con ese nombre.");
      return;
    }

    const nextCategory = {
      key: buildCustomCategoryKey(label, categories),
      label,
      icon,
      keywords: [],
      custom: true,
    };

    const saved = await persistTagSettings({ categories: [...customCategories, nextCategory] });

    if (saved) {
      setCategoryDialogOpen(false);
    }
  }

  async function moveTag(tag, categoryKey) {
    const normalized = normalizeTag(tag);
    const nextOverrides = { ...overrides };

    if (categoryKey === "auto") {
      delete nextOverrides[normalized];
    } else {
      nextOverrides[normalized] = categoryKey;
    }

    const saved = await persistTagSettings({ overrides: nextOverrides });

    if (saved) {
      setMoveDialog(null);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div id="tag-panel-overlay" className="tag-panel-overlay visible" onClick={onClose} />
      <aside id="tag-panel" className="tag-panel open">
        <div className="tag-panel-header">
          <h2 className="tag-panel-title">🏷️ Explorar Tags</h2>
          <button type="button" id="btn-close-tag-panel" className="tag-panel-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="tag-panel-search-wrapper">
          <input
            type="search"
            id="tag-panel-search"
            className="tag-panel-search"
            placeholder="🔍 Buscar tag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div id="tag-panel-body" className="tag-panel-body">
          {settingsError ? <p className="tag-settings-error">{settingsError}</p> : null}

          {groups.map((group) => (
            <section
              key={group.key}
              className={`tag-category ${collapsed[group.key] ? "collapsed" : ""}`}
            >
              <div
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
              </div>

              <div className="tag-category-tags">
                {group.tags.map((tag) => {
                  const isActive = selectedTag === tag;

                  return (
                    <div
                      key={tag}
                      className={`tag-pill-sidebar ${isActive ? "active-tag" : ""} ${isAdmin ? "admin-mode" : ""}`}
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
                      </button>

                      {isAdmin ? (
                        <>
                          <button
                            type="button"
                            className="tag-move-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMoveDialog({ tag, currentCategoryKey: group.key });
                            }}
                            aria-label={`Cambiar categoria de ${tag}`}
                          >
                            ↕
                          </button>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {isAdmin ? (
            <div className="tag-admin-actions">
              <button type="button" className="tag-admin-action" onClick={openCategoryDialog}>
                Crear categoria
              </button>
              <button
                type="button"
                className="tag-override-reset"
                onClick={() => persistTagSettings({ overrides: {} })}
                disabled={isSavingSettings}
              >
                Resetear categorias manuales
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {moveDialog ? (
        <div className="modal-backdrop tag-move-backdrop" onClick={() => setMoveDialog(null)}>
          <div className="modal-content tag-move-modal" onClick={(event) => event.stopPropagation()}>
            <div className="tag-move-modal-header">
              <div>
                <p className="tag-move-kicker">Cambiar categoria</p>
                <h2 className="modal-title tag-move-modal-title">{moveDialog.tag}</h2>
              </div>
              <button type="button" className="tag-panel-close" onClick={() => setMoveDialog(null)}>
                ✕
              </button>
            </div>

            <div className="tag-move-category-grid">
              {categories.map((category) => {
                const isCurrent = category.key === moveDialog.currentCategoryKey;

                return (
                  <button
                    type="button"
                    key={category.key}
                    className={`tag-move-category-option ${isCurrent ? "is-current" : ""}`}
                    onClick={() => moveTag(moveDialog.tag, category.key)}
                    disabled={isCurrent || isSavingSettings}
                  >
                    <span className="tag-move-category-icon">{category.icon}</span>
                    <span>
                      <strong>{category.label}</strong>
                      {isCurrent ? <small>Categoria actual</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="modal-actions tag-move-actions">
              <button
                type="button"
                className="btn-modal btn-modal-secondary"
                onClick={() => setMoveDialog(null)}
                disabled={isSavingSettings}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-modal btn-modal-primary"
                onClick={() => moveTag(moveDialog.tag, "auto")}
                disabled={isSavingSettings}
              >
                Usar categoria automatica
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {categoryDialogOpen ? (
        <div className="modal-backdrop tag-move-backdrop" onClick={() => setCategoryDialogOpen(false)}>
          <form className="modal-content tag-move-modal tag-category-create-modal" onSubmit={createCategory} onClick={(event) => event.stopPropagation()}>
            <div className="tag-move-modal-header">
              <div>
                <p className="tag-move-kicker">Nueva categoria</p>
                <h2 className="modal-title tag-move-modal-title">Crear categoria de tags</h2>
              </div>
              <button type="button" className="tag-panel-close" onClick={() => setCategoryDialogOpen(false)}>
                ✕
              </button>
            </div>

            <div className="form-row">
              <div className="form-group-modal">
                <label htmlFor="tag-category-name">Nombre</label>
                <input
                  id="tag-category-name"
                  type="text"
                  className="modal-input"
                  value={categoryDraft.label}
                  onChange={(event) => {
                    setCategoryDraft((current) => ({ ...current, label: event.target.value }));
                    setCategoryError("");
                  }}
                  autoFocus
                />
              </div>

              <div className="form-group-modal">
                <label htmlFor="tag-category-icon">Icono</label>
                <input
                  id="tag-category-icon"
                  type="text"
                  className="modal-input"
                  value={categoryDraft.icon}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, icon: event.target.value }))}
                  maxLength={4}
                />
              </div>
            </div>

            {categoryError ? <p className="tag-category-error">{categoryError}</p> : null}

            <div className="modal-actions tag-move-actions">
              <button
                type="button"
                className="btn-modal btn-modal-secondary"
                onClick={() => setCategoryDialogOpen(false)}
                disabled={isSavingSettings}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-modal btn-modal-primary" disabled={isSavingSettings}>
                Crear categoria
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
