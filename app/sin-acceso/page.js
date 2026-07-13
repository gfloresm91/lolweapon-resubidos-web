import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Sin acceso | LOLWEAPON",
  description: "No tienes permisos para entrar a esta pantalla.",
};

function getSafeReturnPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/")) {
    return null;
  }

  const pathname = value.split("?")[0].split("#")[0];
  if (["/login", "/registro", "/sin-acceso"].includes(pathname)) {
    return null;
  }

  return value;
}

export default async function AccessDeniedPage({ searchParams }) {
  const params = await searchParams;
  const from = getSafeReturnPath(params?.from);

  return (
    <main className="auth-shell">
      <section className="auth-card access-denied-card" aria-labelledby="access-denied-title">
        <div className="auth-header">
          <div className="access-denied-icon" aria-hidden="true">
            <ShieldAlert size={24} />
          </div>
          <span className="auth-eyebrow">Acceso restringido</span>
          <h1 id="access-denied-title" className="auth-title">No tienes acceso a esta pantalla</h1>
          <p className="auth-subtitle">
            Tu sesión está activa, pero tu rol actual no tiene el permiso necesario para entrar
            {from ? ` a ${from}` : " a esta ruta"}.
          </p>
        </div>
        <div className="access-denied-actions">
          <Link className="btn-login" href="/inicio">Volver al inicio</Link>
          <Link className="access-denied-secondary" href="/rtfm">Ver mapa de accesos</Link>
        </div>
      </section>
    </main>
  );
}
