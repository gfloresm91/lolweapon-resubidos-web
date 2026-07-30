import Link from "next/link";
import { SearchX } from "lucide-react";

export const metadata = {
  title: "Tier list no disponible | LOLWEAPON",
  description: "Este tier list ya no está disponible para compartir.",
};

export default function SharedTierListNotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card access-denied-card" aria-labelledby="tierlist-not-found-title">
        <div className="auth-header">
          <div className="access-denied-icon" aria-hidden="true">
            <SearchX size={24} />
          </div>
          <h1 id="tierlist-not-found-title" className="auth-title">Este tier list ya no está disponible</h1>
          <p className="auth-subtitle">
            Puede que quien lo compartió lo haya hecho privado, o el link ya no sea válido.
          </p>
        </div>
        <div className="access-denied-actions">
          <Link className="btn-login" href="/inicio">Volver al inicio</Link>
        </div>
      </section>
    </main>
  );
}
