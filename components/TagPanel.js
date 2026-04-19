"use client";

import { useEffect, useMemo, useState } from "react";

import { buildTagGroups, normalizeTag, TAG_CATEGORIES } from "@/lib/tags";

const OVERRIDE_STORAGE_KEY = "kala_tag_cat_overrides";

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
  const [collapsed, setCollapsed] = useState({});
  const [moveMenu, setMoveMenu] = useState(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OVERRIDE_STORAGE_KEY);
      setOverrides(saved ? JSON.parse(saved) : {});
    } catch {
      setOverrides({});
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMoveMenu(null);
      setSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (moveMenu) {
          setMoveMenu(null);
          return;
        }

        onClose();
      }
    }

    function handlePointerDown(event) {
      const popup = document.querySelector(".tag-move-popup");
      if (moveMenu && popup && !popup.contains(event.target)) {
        setMoveMenu(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, moveMenu, onClose]);

  const groups = useMemo(() => {
    const filteredTags = tags.filter((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    return buildTagGroups(filteredTags, overrides);
  }, [overrides, search, tags]);

  function persistOverrides(nextOverrides) {
    setOverrides(nextOverrides);
    window.localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(nextOverrides));
  }

  function moveTag(tag, categoryKey) {
    const normalized = normalizeTag(tag);
    const nextOverrides = { ...overrides };

    if (categoryKey === "auto") {
      delete nextOverrides[normalized];
    } else {
      nextOverrides[normalized] = categoryKey;
    }

    persistOverrides(nextOverrides);
    setMoveMenu(null);
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
                  const isMoveOpen = moveMenu === tag;

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
                              setMoveMenu((current) => (current === tag ? null : tag));
                            }}
                          >
                            ↕
                          </button>

                          {isMoveOpen ? (
                            <div className="tag-move-popup">
                              <div className="tag-move-popup-title">
                                Mover <strong>{tag}</strong>
                              </div>
                              {TAG_CATEGORIES.filter((category) => category.key !== group.key).map((category) => (
                                <button
                                  type="button"
                                  key={category.key}
                                  className="tag-move-option"
                                  onClick={() => moveTag(tag, category.key)}
                                >
                                  {category.icon} {category.label}
                                </button>
                              ))}
                              <button
                                type="button"
                                className="tag-move-option tag-move-auto"
                                onClick={() => moveTag(tag, "auto")}
                              >
                                Restablecer a categoria automatica
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {isAdmin ? (
            <button
              type="button"
              className="tag-override-reset"
              onClick={() => persistOverrides({})}
            >
              Resetear categorias manuales
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
