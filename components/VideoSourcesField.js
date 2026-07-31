"use client";

import { Plus, Trash2 } from "lucide-react";

export default function VideoSourcesField({ sources, onChange }) {
  function updateSource(index, field, value) {
    onChange(sources.map((source, current) => (current === index ? { ...source, [field]: value } : source)));
  }

  function removeSource(index) {
    onChange(sources.filter((_, current) => current !== index));
  }

  function addSource() {
    onChange([...sources, { label: "", url: "" }]);
  }

  return (
    <div className="tierlist-sources-field">
      {sources.map((source, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="form-row tierlist-source-row" key={index}>
          <input
            className="modal-input"
            value={source.label}
            onChange={(event) => updateSource(index, "label", event.target.value)}
            placeholder="Fuente alternativa"
          />
          <input
            className="modal-input"
            value={source.url}
            onChange={(event) => updateSource(index, "url", event.target.value)}
            placeholder="https://..."
          />
          <button
            type="button"
            className="icon-tool-button tierlist-source-remove"
            onClick={() => removeSource(index)}
            aria-label="Quitar fuente"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button type="button" className="tracker-action-secondary" onClick={addSource}>
        <Plus size={16} /> Agregar fuente
      </button>
    </div>
  );
}
