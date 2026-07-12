"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Toaster, toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

import AuthBackButton from "@/components/AuthBackButton";
import { LOGIN_MAX_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/platformUserValidation";

const loginSchema = z.object({
  login: z.string().trim().min(1, "El usuario es obligatorio."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

function getSafeReturnPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/")) {
    return null;
  }

  const pathname = value.split("?")[0].split("#")[0];
  if (["/login", "/registro"].includes(pathname)) {
    return null;
  }

  return value;
}

function appendConnectedParam(path, provider) {
  const [baseAndQuery, hash = ""] = String(path || "/inicio").split("#");
  const [pathname, query = ""] = baseAndQuery.split("?");
  const params = new URLSearchParams(query);
  params.set("connected", provider);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

function getProviderLabel(provider) {
  if (provider === "google") return "Google / YouTube";
  if (provider === "twitch") return "Twitch";
  return "la cuenta externa";
}

function getLoginMethodLabel(method) {
  if (method === "manual") return "usuario y contraseña";
  if (method === "google") return "Google / YouTube";
  if (method === "twitch") return "Twitch";
  return "tu método actual";
}

function getLoginMethodsLabel(methods) {
  const labels = methods.map(getLoginMethodLabel);
  if (!labels.length) return "tu método actual";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} o ${labels.at(-1)}`;
}

function getSafeLoginMethod(method) {
  return ["manual", "google", "twitch"].includes(method) ? method : null;
}

function getSafeLoginMethods(value, fallback) {
  const methods = String(value || "")
    .split(",")
    .map((method) => getSafeLoginMethod(method.trim()))
    .filter(Boolean);

  return [...new Set(methods.length ? methods : [fallback].filter(Boolean))];
}

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [nextPath, setNextPath] = useState("/inicio");
  const [pendingProvider, setPendingProvider] = useState(null);
  const [pendingLoginMethods, setPendingLoginMethods] = useState([]);
  const twitchLoginHref = `/api/auth/twitch/start?returnTo=${encodeURIComponent(nextPath)}`;
  const googleLoginHref = `/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`;
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
    const returnTo = params.get("returnTo");
    const linkRequired = params.get("linkRequired");
    const loginMethod = getSafeLoginMethod(params.get("loginMethod"));
    const loginMethods = getSafeLoginMethods(params.get("loginMethods"), loginMethod);
    const safeReturnTo = getSafeReturnPath(returnTo);
    const safeNext = getSafeReturnPath(next);

    if (safeReturnTo || safeNext) {
      setNextPath(safeReturnTo || safeNext);
    }

    if (error) {
      toast.error(error);
    } else if (linkRequired) {
      setPendingProvider(linkRequired);
      setPendingLoginMethods(loginMethods);
      toast.info(
        `Ya existe una cuenta con ese correo. Inicia sesión con ${getLoginMethodsLabel(loginMethods)} para conectar ${getProviderLabel(linkRequired)}.`,
      );
    }
  }, []);

  function focusManualLogin() {
    setFocus("login");
  }

  const canConfirmWithManual = pendingLoginMethods.includes("manual");
  const canConfirmWithTwitch = pendingLoginMethods.includes("twitch");
  const canConfirmWithGoogle = pendingLoginMethods.includes("google");

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

      const redirectTo = data.linkedProvider ? appendConnectedParam(nextPath, data.linkedProvider) : nextPath;
      router.push(redirectTo);
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
          <h1 id="login-title" className="auth-title">Bienvenido a Lolweapon</h1>
          <p className="auth-subtitle">Inicia sesión con tu cuenta o conecta Twitch / YouTube.</p>
        </div>

        <div className="auth-provider-row" aria-label="Proveedores de inicio de sesion">
          <a href={twitchLoginHref} className="auth-provider-button twitch-login-button">
            <span>Twitch</span>
            <strong>{canConfirmWithTwitch ? "Conectar" : "Entrar"}</strong>
          </a>
          <a href={googleLoginHref} className="auth-provider-button youtube-login-button">
            <span>YouTube</span>
            <strong>{canConfirmWithGoogle ? "Conectar" : "Entrar"}</strong>
          </a>
        </div>

        {pendingProvider ? (
          <div className="auth-link-notice" role="status" aria-live="polite">
            <span className="auth-link-notice-eyebrow">Conexión pendiente</span>
            <strong>Ya existe una cuenta con ese correo.</strong>
            <p>
              Para protegerla, inicia sesión con {getLoginMethodsLabel(pendingLoginMethods)}. Después conectaremos{" "}
              {getProviderLabel(pendingProvider)} automáticamente y podrás entrar con cualquiera de los dos métodos.
            </p>
            {canConfirmWithManual ? (
              <button type="button" className="auth-link-notice-action" onClick={focusManualLogin}>
                Iniciar con usuario y contraseña
              </button>
            ) : null}
            {canConfirmWithTwitch ? (
              <a href={twitchLoginHref} className="auth-link-notice-action">Conectar iniciando con Twitch</a>
            ) : null}
            {canConfirmWithGoogle ? (
              <a href={googleLoginHref} className="auth-link-notice-action">Conectar iniciando con Google / YouTube</a>
            ) : null}
          </div>
        ) : null}

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
          ¿No tienes cuenta? <Link href={`/registro?returnTo=${encodeURIComponent(nextPath)}`}>Registrarme</Link>
        </p>

        <AuthBackButton fallbackHref="/inicio" returnHref={nextPath} />

      </section>
    </main>
  );
}
