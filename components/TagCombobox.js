"use client";

import { useEffect, useRef, useState } from "react";

function normalizeComparable(value) {
  return String(value || "").trim().toLowerCase();
}

export default function TagCombobox({
  value,
  tags = [],
  tagCounts = {},
  onChange,
  onSelect,
  placeholder = "Buscar o crear tag",
  countLabel = "resubidos",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const normalizedSearch = normalizeComparable(search);
  const filteredTags = tags
    .filter((tag) => normalizeComparable(tag).includes(normalizedSearch))
    .slice(0, 8);
  const exactMatch = tags.some((tag) => normalizeComparable(tag) === normalizedSearch);
  const canCreate = search.trim() && !exactMatch;
  const options = [
    ...filteredTags.map((tag) => ({ type: "tag", value: tag })),
    ...(canCreate ? [{ type: "create", value: search.trim() }] : []),
  ];

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search, tags]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
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

  function selectTag(tag) {
    if (onSelect) {
      onSelect(tag);
      onChange("");
      setSearch("");
    } else {
      onChange(tag);
      setSearch(tag);
    }
    setIsOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = options[activeIndex] || (search.trim() ? { value: search.trim() } : null);

      if (option?.value) {
        selectTag(option.value);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="tag-combobox">
      <input
        className="modal-input"
        placeholder={placeholder}
        value={search}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          setSearch(event.target.value);
          onChange(event.target.value);
          setIsOpen(true);
        }}
      />
      {isOpen ? (
        <div className="tag-combobox-menu">
          {options.map((option, index) => (
            <button
              key={`${option.type}-${option.value}`}
              type="button"
              className={[
                "tag-combobox-option",
                option.type === "create" ? "is-create" : "",
                index === activeIndex ? "is-active" : "",
              ].filter(Boolean).join(" ")}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectTag(option.value)}
            >
              <span>{option.type === "create" ? `Crear "${option.value}"` : option.value}</span>
              <small>{option.type === "create" ? "Nuevo tag" : `${tagCounts[option.value] || 0} ${countLabel}`}</small>
            </button>
          ))}
          {!filteredTags.length && !canCreate ? <p className="tag-combobox-empty">No hay tags disponibles.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
