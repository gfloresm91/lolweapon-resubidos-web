"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Toaster, toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

import { LOGIN_MAX_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/platformUserValidation";

const loginSchema = z.object({
  login: z.string().trim().min(1, "El usuario es obligatorio."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [nextPath, setNextPath] = useState("/");
  const {
    formState: { errors },
    handleSubmit,
    register,
    setFocus,
    setValue,
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      login: "",
      password: "",
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const next = params.get("next");

    if (next?.startsWith("/") && !next.startsWith("//")) {
      setNextPath(next);
    }

    if (error) {
      toast.error(error);
    }
  }, []);

  async function submitLogin(values) {
    setIsSubmitting(true);
    const normalizedValues = {
      ...values,
      login: values.login.trim().toLowerCase(),
    };
    setValue("login", normalizedValues.login);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedValues),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error("Credenciales incorrectas");
        setFocus("password");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      toast.error("No se pudo iniciar sesión. Intenta nuevamente.");
      setFocus("password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <Toaster position="top-right" richColors closeButton />
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-header">
          <span className="auth-brand" aria-hidden="true">
            <img src="/brand/lolweapon-logo.png" alt="" />
            <strong>LOLWEAPON</strong>
          </span>
          <h1 id="login-title" className="auth-title">Lives Tracker</h1>
          <p className="auth-subtitle">Inicia sesión con tu usuario o conecta una cuenta externa.</p>
        </div>

        <div className="auth-provider-row" aria-label="Proveedores de inicio de sesion">
          <a href="/api/auth/twitch/start" className="auth-provider-button twitch-login-button">
            <span>Twitch</span>
            <strong>Entrar</strong>
          </a>
          <button type="button" className="auth-provider-button youtube-login-button" disabled>
            <span>YouTube</span>
            <strong>Próximamente</strong>
          </button>
        </div>

        <div className="auth-divider">
          <span>Usuario y contraseña</span>
        </div>

        <form id="login-form" className="auth-form" onSubmit={handleSubmit(submitLogin)} noValidate>
          <div className="auth-field">
              <label htmlFor="login">Usuario</label>
              <input
                type="text"
                id="login"
                autoComplete="username"
                maxLength={LOGIN_MAX_LENGTH}
                aria-invalid={Boolean(errors.login)}
                aria-describedby={errors.login ? "login-error" : undefined}
                {...register("login")}
              />
              {errors.login ? <span id="login-error" className="auth-field-error">{errors.login.message}</span> : null}
          </div>

          <div className="auth-field">
              <label htmlFor="password">Contraseña</label>
              <div className="auth-password-field">
                <input
                  type={isPasswordVisible ? "text" : "password"}
                  id="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                >
                  {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password ? <span id="password-error" className="auth-field-error">{errors.password.message}</span> : null}
          </div>

          <button type="submit" id="btn-submit" className="auth-submit-button" disabled={isSubmitting}>
            {isSubmitting ? <span className="auth-submit-spinner" aria-hidden="true" /> : null}
            <span>{isSubmitting ? "Verificando..." : "Entrar"}</span>
            {!isSubmitting ? <span aria-hidden="true">→</span> : null}
          </button>
        </form>

        <p className="auth-footer-copy">
          ¿No tienes cuenta? <Link href="/registro">Registrarme</Link>
        </p>

        <Link href="/" className="auth-back-link">
          <span aria-hidden="true">←</span>
          Volver a la web
        </Link>

      </section>
    </main>
  );
}
