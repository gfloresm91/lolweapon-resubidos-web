"use client";

import { useEffect, useState } from "react";

export default function AppSidebarShell({ children, extraShellClass = "", sidebarId = "main-sidebar" }) {
  const [isOpen, setIsOpen] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    setIsOpen(mq.matches);
    const handler = (e) => setIsOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    function handleClose() { setIsOpen(false); }
    window.addEventListener("kala:sidebar:close", handleClose);
    return () => window.removeEventListener("kala:sidebar:close", handleClose);
  }, []);

  useEffect(() => {
    const sidebar = document.getElementById(sidebarId);
    if (sidebar) {
      sidebar.classList.toggle("is-open", Boolean(isOpen));
      sidebar.classList.toggle("is-closed", isOpen === false);
    }
    document.body.classList.toggle("is-app-sidebar-open", Boolean(isOpen));
    return () => document.body.classList.remove("is-app-sidebar-open");
  }, [isOpen, sidebarId]);

  function toggle() {
    setIsOpen((current) => {
      if (current === null) return !window.matchMedia("(min-width: 901px)").matches;
      return !current;
    });
  }

  const shellClass = ["app-shell", extraShellClass, isOpen === false ? "is-sidebar-closed" : ""]
    .filter(Boolean).join(" ");

  return (
    <div className={shellClass}>
      <button
        type="button"
        className={`hamburger-button ${isOpen ? "is-open" : ""}`}
        aria-label={isOpen === false ? "Abrir menu" : "Cerrar menu"}
        aria-expanded={Boolean(isOpen)}
        aria-controls={sidebarId}
        onClick={toggle}
      >
        <span />
        <span />
        <span />
      </button>

      {isOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Cerrar menu"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {children}
    </div>
  );
}
