"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";

function SourceRow({ source, onUpdate, onRemove, dragHandleProps, isOverlay = false, isDragging = false }) {
  return (
    <div className={`form-row tierlist-source-row ${isDragging ? "is-dragging" : ""} ${isOverlay ? "is-overlay" : ""}`}>
      <button
        type="button"
        className="icon-tool-button tierlist-source-drag-handle"
        aria-label="Arrastrar para reordenar"
        {...dragHandleProps}
      >
        <GripVertical size={16} />
      </button>
      <input
        className="modal-input"
        value={source.label}
        onChange={(event) => onUpdate?.("label", event.target.value)}
        placeholder="Fuente alternativa"
      />
      <input
        className="modal-input"
        value={source.url}
        onChange={(event) => onUpdate?.("url", event.target.value)}
        placeholder="https://..."
      />
      <button
        type="button"
        className="icon-tool-button tierlist-source-remove"
        onClick={onRemove}
        aria-label="Quitar fuente"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function SortableSourceRow({ id, source, onUpdate, onRemove }) {
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div ref={sortable.setNodeRef} style={style}>
      <SourceRow
        source={source}
        onUpdate={onUpdate}
        onRemove={onRemove}
        isDragging={sortable.isDragging}
        dragHandleProps={{ ...sortable.attributes, ...sortable.listeners }}
      />
    </div>
  );
}

export default function VideoSourcesField({ sources, onChange }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function updateSource(index, field, value) {
    onChange(sources.map((source, current) => (current === index ? { ...source, [field]: value } : source)));
  }

  function removeSource(index) {
    onChange(sources.filter((_, current) => current !== index));
  }

  function addSource() {
    onChange([...sources, { id: crypto.randomUUID(), label: "", url: "" }]);
  }

  function handleDragStart(event) {
    setActiveIndex(sources.findIndex((source) => source.id === event.active.id));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveIndex(null);
    if (!over || active.id === over.id) return;
    const oldIndex = sources.findIndex((source) => source.id === active.id);
    const newIndex = sources.findIndex((source) => source.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(sources, oldIndex, newIndex));
  }

  const itemIds = sources.map((source) => source.id);

  return (
    <div className="tierlist-sources-field">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveIndex(null)}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {sources.map((source, index) => (
            <SortableSourceRow
              key={source.id}
              id={source.id}
              source={source}
              onUpdate={(field, value) => updateSource(index, field, value)}
              onRemove={() => removeSource(index)}
            />
          ))}
        </SortableContext>
        {typeof document !== "undefined" ? createPortal(
          <DragOverlay>
            {activeIndex != null && sources[activeIndex] ? (
              <SourceRow source={sources[activeIndex]} isOverlay />
            ) : null}
          </DragOverlay>,
          document.body,
        ) : null}
      </DndContext>
      <button type="button" className="tracker-action-secondary" onClick={addSource}>
        <Plus size={16} /> Agregar fuente
      </button>
    </div>
  );
}
