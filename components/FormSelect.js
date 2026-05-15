"use client";

import { useEffect, useRef, useState } from "react";

export default function FormSelect({ id, label, value, options = [], onChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0] || { label: "Seleccionar", value: "" };

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
    <div ref={selectRef} className={`form-select ${disabled ? "is-disabled" : ""}`} id={id}>
      <button
        type="button"
        className={`form-select-button ${isOpen ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={disabled ? false : isOpen}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
      >
        <span className="form-select-label">{label}</span>
        <strong>{selectedOption.label}</strong>
        <span className="form-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen && !disabled ? (
        <div className="form-select-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`form-select-option ${option.value === value ? "is-selected" : ""}`}
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
