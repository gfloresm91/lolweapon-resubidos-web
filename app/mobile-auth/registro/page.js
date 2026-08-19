"use client";

// Puente mínimo para el caso "registration-required" del relay OAuth mobile: el proveedor no
// coincide con ninguna cuenta existente. Placeholder funcional, no comparte el diseño de
// /registro todavía - suficiente para no dejar el flujo mobile en un callejón sin salida.
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function RegistroForm() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId");
  const scheme = searchParams.get("scheme");
  const clientType = searchParams.get("clientType") || "unknown";

  const [login, setLogin] = useState(searchParams.get("suggestedLogin") || "");
  const [alias, setAlias] = useState(searchParams.get("suggestedAlias") || "");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/mobile/v1/auth/oauth/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, login, alias, clientType }),
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "No se pudo completar el registro.");
        setLoading(false);
        return;
      }

      window.location.href = `${scheme}://auth-callback?exchangeCode=${encodeURIComponent(data.exchangeCode)}`;
    } catch {
      setError("No se pudo conectar con el servidor.");
      setLoading(false);
    }
  }

  if (!attemptId || !scheme) {
    return <p>Enlace inválido o expirado. Vuelve a intentar el inicio de sesión desde la app.</p>;
  }

  return (
    <div style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Completar registro</h1>
      <p>Es la primera vez que inicias sesión con este proveedor. Confirma tus datos.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder="Usuario" value={login} onChange={(event) => setLogin(event.target.value)} required />
        <input placeholder="Nombre visible" value={alias} onChange={(event) => setAlias(event.target.value)} required />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Creando cuenta…" : "Crear cuenta e ingresar"}</button>
      </form>
    </div>
  );
}

export default function RegistroMobilePage() {
  return (
    <Suspense fallback={null}>
      <RegistroForm />
    </Suspense>
  );
}
