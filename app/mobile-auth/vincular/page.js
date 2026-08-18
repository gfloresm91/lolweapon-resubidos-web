"use client";

// Puente mínimo para el caso "link-required" del relay OAuth mobile: el email de la cuenta de
// Twitch/Google ya existe con otro método de login. Placeholder funcional, no comparte el diseño
// de /login todavía - suficiente para no dejar el flujo mobile en un callejón sin salida.
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function VincularForm() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId");
  const scheme = searchParams.get("scheme");
  const clientType = searchParams.get("clientType") || "unknown";

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/mobile/v1/auth/oauth/complete-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, login, password, clientType }),
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "No se pudo vincular la cuenta.");
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
      <h1>Vincular cuenta</h1>
      <p>Ya existe una cuenta con ese correo. Inicia sesión con tu método actual para conectar este proveedor.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder="Usuario" value={login} onChange={(event) => setLogin(event.target.value)} required />
        <input placeholder="Contraseña" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Vinculando…" : "Vincular e ingresar"}</button>
      </form>
    </div>
  );
}

export default function VincularMobilePage() {
  return (
    <Suspense fallback={null}>
      <VincularForm />
    </Suspense>
  );
}
