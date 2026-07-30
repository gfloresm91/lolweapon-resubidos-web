"use client";

import AnimeTierListBoard from "@/components/AnimeTierListBoard";

export default function AnimeTierListAnimesPage({ isAuthenticated = false, role = "invitado" }) {
  return (
    <AnimeTierListBoard
      kind="animes"
      title="Tier List de"
      highlight="Animes"
      subtitle="Arrastra los animes de la temporada a la fila que corresponda a tu ranking."
      isAuthenticated={isAuthenticated}
      role={role}
    />
  );
}
