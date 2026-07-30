import Link from "next/link";
import { SearchX } from "lucide-react";

export const metadata = {
  title: "Página no encontrada | LOLWEAPON",
  description: "La página que buscas no existe o fue movida.",
};

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card access-denied-card" aria-labelledby="not-found-title">
        <div className="auth-header">
          <div className="access-denied-icon" aria-hidden="true">
            <SearchX size={24} />
          </div>
          <h1 id="not-found-title" className="auth-title">No encontramos esta página</h1>
          <p className="auth-subtitle">
            La URL puede estar mal escrita, o el contenido que buscabas ya no existe.
          </p>
        </div>
        <div className="access-denied-actions">
          <Link className="btn-login" href="/inicio">Volver al inicio</Link>
        </div>
      </section>
    </main>
  );
}
