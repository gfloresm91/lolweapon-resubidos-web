"use client";

import { useState } from "react";

export default function TagsInput({ value = [], onChange, error }) {
  const [draft, setDraft] = useState("");

  function commitTag(rawValue) {
    const nextTag = String(rawValue || "").trim();
    if (!nextTag) {
      return;
    }

    if (value.includes(nextTag)) {
      setDraft("");
      return;
    }

    onChange([...(value || []), nextTag]);
    setDraft("");
  }

  function removeTag(tagToRemove) {
    onChange((value || []).filter((tag) => tag !== tagToRemove));
  }

  return (
    <div className={`tags-input-wrapper ${error ? "tags-input-wrapper--error" : ""}`}>
      <div className="tags-chip-list">
        {(value || []).map((tag) => (
          <span key={tag} className="tags-chip">
            {tag}
            <button type="button" className="tags-chip-remove" onClick={() => removeTag(tag)}>
              ✕
            </button>
          </span>
        ))}

        <input
          type="text"
          className="tags-chip-input"
          value={draft}
          placeholder={(value || []).length ? "Agregar tag..." : "Escribe un tag y pulsa Enter"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commitTag(draft);
            }

            if (event.key === "Backspace" && !draft && value.length) {
              removeTag(value[value.length - 1]);
            }
          }}
          onBlur={() => commitTag(draft)}
        />
      </div>
    </div>
  );
}
