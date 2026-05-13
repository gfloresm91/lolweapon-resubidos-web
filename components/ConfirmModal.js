"use client";

import { X } from "lucide-react";

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop confirm-backdrop">
      <div className="modal-content confirm-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close-button" aria-label="Cerrar modal" onClick={onCancel} disabled={isLoading}>
          <X size={18} />
        </button>
        <h2 className="modal-title">{title}</h2>
        <p className="confirm-copy">{description}</p>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-modal btn-modal-secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn-modal ${tone === "danger" ? "btn-modal-danger" : "btn-modal-primary"}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
