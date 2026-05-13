"use client";

import { X } from "lucide-react";

export default function MaintainerModal({
  as: Component = "div",
  title,
  subtitle = "",
  children,
  actions = null,
  className = "admin-modal",
  onClose,
  ...props
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <Component
        className={`modal-content ${className}`.trim()}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        <button type="button" className="modal-close-button" aria-label="Cerrar modal" onClick={onClose}>
          <X size={18} />
        </button>
        <h2 className="modal-title">{title}</h2>
        {subtitle ? <p className="admin-modal-help">{subtitle}</p> : null}
        {children}
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </Component>
    </div>
  );
}
