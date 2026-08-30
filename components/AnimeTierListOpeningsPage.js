"use client";

import { useState } from "react";

import AnimeTierListBoard from "@/components/AnimeTierListBoard";

export default function AnimeTierListOpeningsPage({ isAuthenticated = false, role = "visitante" }) {
  const [kind, setKind] = useState("op");

  return (
    <AnimeTierListBoard
      kind={kind}
      title="Tier List de"
      highlight={kind === "op" ? "Openings" : "Endings"}
      subtitle="Haz clic en un tema para escuchar el video antes de rankearlo. Cada anime aparece una vez por cada tema que tenga."
      isAuthenticated={isAuthenticated}
      role={role}
      viewToggle={
        <div className="tracker-calendar-view-toggle" role="tablist" aria-label="Openings o Endings">
          <button type="button" role="tab" aria-selected={kind === "op"} className={kind === "op" ? "is-active" : ""} onClick={() => setKind("op")}>Openings</button>
          <button type="button" role="tab" aria-selected={kind === "ed"} className={kind === "ed" ? "is-active" : ""} onClick={() => setKind("ed")}>Endings</button>
        </div>
      }
    />
  );
}
