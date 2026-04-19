"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Error de autenticacion");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (requestError) {
      setError("Error de conexion con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-body">
      <div className="bg-orb orb-1" aria-hidden="true" />
      <div className="bg-orb orb-2" aria-hidden="true" />

      <div className="login-container">
        <div className="login-glass-panel">
          <h1 className="login-title">Lives Tracker</h1>
          <p className="login-subtitle">Acceso seguro para Moderadores</p>

          <form id="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="password">Contraseña Maestra</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <button type="submit" id="btn-submit" className="btn-login" disabled={isSubmitting}>
              <span className="btn-text">{isSubmitting ? "Verificando..." : "Autenticar"}</span>
              <span className="btn-icon">→</span>
            </button>
          </form>

          {error ? (
            <div id="error-msg" className="error-msg">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

