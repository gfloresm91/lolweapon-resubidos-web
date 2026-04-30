"use client";

import { useEffect, useState } from "react";

export default function DetailSidebarControls() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 901px)");

    function syncSidebarState(event) {
      setIsOpen(event.matches);
    }

    setIsOpen(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  useEffect(() => {
    const sidebar = document.getElementById("main-sidebar");
    const shell = sidebar?.closest(".app-shell");

    if (!sidebar || !shell) {
      return;
    }

    sidebar.classList.toggle("is-open", isOpen);
    sidebar.classList.toggle("is-closed", !isOpen);
    shell.classList.toggle("is-sidebar-closed", !isOpen);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className={`hamburger-button ${isOpen ? "is-open" : ""}`}
        aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
        aria-expanded={isOpen}
        aria-controls="main-sidebar"
        onClick={() => setIsOpen((current) => !current)}
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
    </>
  );
}
