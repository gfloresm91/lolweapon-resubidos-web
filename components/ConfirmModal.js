"use client";

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

