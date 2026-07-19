"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Toaster, toast } from "sonner";
import { z } from "zod";

import AuthBackButton from "@/components/AuthBackButton";
import AuthSessionGuard from "@/components/AuthSessionGuard";
import {
  ALIAS_MAX_LENGTH,
  ALIAS_RULES,
  EMAIL_MAX_LENGTH,
  EMAIL_RULES,
  getPasswordStrength,
  LOGIN_MAX_LENGTH,
  LOGIN_RULES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_RULES,
} from "@/lib/platformUserValidation";

const passwordConfirmationRules = z
  .string()
  .max(72, "La confirmación no puede superar 72 caracteres.");

const registerSchema = z.object({
  login: LOGIN_RULES,
  alias: ALIAS_RULES,
  email: EMAIL_RULES,
  oauthProvider: z.string().optional(),
  password: z.string().max(PASSWORD_MAX_LENGTH, "La contraseña no puede superar 72 caracteres."),
  confirmPassword: passwordConfirmationRules,
}).superRefine((values, context) => {
  const isOAuthRegister = ["google", "twitch"].includes(values.oauthProvider || "");

  if (isOAuthRegister && !values.password && !values.confirmPassword) return;

  const passwordResult = PASSWORD_RULES.safeParse(values.password);
  if (!passwordResult.success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: passwordResult.error.issues[0]?.message || "Ingresa una contraseña válida.",
    });
    return;
  }

  if (!values.confirmPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Confirma tu contraseña.",
    });
    return;
  }

  if (values.password !== values.confirmPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Las contraseñas no coinciden.",
    });
  }
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

function getProviderLabel(provider) {
  if (provider === "google") return "Google / YouTube";
  if (provider === "twitch") return "Twitch";
  return "tu cuenta externa";
}

export default function RegisterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOAuth, setIsLoadingOAuth] = useState(false);
  const [nextPath, setNextPath] = useState("/inicio");
  const [oauthProvider, setOauthProvider] = useState("");
  const [showManualAccess, setShowManualAccess] = useState(false);
  const twitchRegisterHref = `/api/auth/twitch/start?returnTo=${encodeURIComponent(nextPath)}`;
  const googleRegisterHref = `/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const returnTo = params.get("returnTo");
    const oauth = params.get("oauth");
    const safeReturnTo = getSafeReturnPath(returnTo);
    const safeNext = getSafeReturnPath(next);

    if (safeReturnTo || safeNext) {
      setNextPath(safeReturnTo || safeNext);
    }

    if (["google", "twitch"].includes(oauth)) {
      setOauthProvider(oauth);
    }
  }, []);
  const [visiblePasswords, setVisiblePasswords] = useState({
    password: false,
    confirmPassword: false,
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      login: "",
      alias: "",
      email: "",
      oauthProvider: "",
      password: "",
      confirmPassword: "",
    },
  });
  const passwordValue = watch("password");
  const passwordStrength = getPasswordStrength(passwordValue);
  const showPasswordStrength = Boolean(passwordValue);
  const providerLabel = getProviderLabel(oauthProvider);

  useEffect(() => {
    setValue("oauthProvider", oauthProvider, { shouldValidate: true });
  }, [oauthProvider, setValue]);

  useEffect(() => {
    if (!oauthProvider) return;
    let isMounted = true;
    setIsLoadingOAuth(true);

    fetch("/api/register/oauth")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "No se pudo cargar el registro conectado.");
        }
        return data.registration;
      })
      .then((registration) => {
        if (!isMounted) return;
        setValue("login", registration.login || "", { shouldValidate: true });
        setValue("alias", registration.alias || "", { shouldValidate: true });
        setValue("email", registration.email || "", { shouldValidate: true });
      })
      .catch((error) => {
        if (!isMounted) return;
        toast.error(error.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingOAuth(false);
      });

    return () => {
      isMounted = false;
    };
  }, [oauthProvider, setValue]);

  function togglePassword(field) {
    setVisiblePasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
  }

  function hideManualAccess() {
    setValue("password", "", { shouldValidate: true });
    setValue("confirmPassword", "", { shouldValidate: true });
    setShowManualAccess(false);
  }

  async function submitRegister(values) {
    setIsSubmitting(true);
    const payload = {
      ...values,
      login: values.login.trim().toLowerCase(),
      alias: values.alias.trim(),
      email: values.email.trim().toLowerCase(),
    };
    setValue("login", payload.login);
    setValue("alias", payload.alias);
    setValue("email", payload.email);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || "No se pudo crear la cuenta.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      toast.error("No se pudo crear la cuenta. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <AuthSessionGuard />
      <Toaster position="top-right" richColors closeButton />
      <section className="auth-card auth-card-wide" aria-labelledby="register-title">
        <div className="auth-header">
          <span className="auth-brand" aria-hidden="true">
            <img src="/brand/lolweapon-logo.png" alt="" />
            <strong>LOLWEAPON</strong>
          </span>
          <h1 id="register-title" className="auth-title">{oauthProvider ? "Finalizar registro" : "Crear cuenta"}</h1>
          <p className="auth-subtitle">
            {oauthProvider
              ? `Confirma cómo quieres aparecer en Lolweapon. Ya podrás iniciar sesión con ${providerLabel}.`
              : "Crea tu cuenta para acceder a Lolweapon."}
          </p>
        </div>

        {oauthProvider ? (
          <div className="auth-link-notice" role="status" aria-live="polite">
            <span className="auth-link-notice-eyebrow">Registro conectado</span>
            <strong>Estás creando una cuenta conectada a {providerLabel}.</strong>
            <p>
              Después podrás iniciar sesión con {providerLabel}. Si agregas una contraseña, también podrás entrar con usuario y contraseña.
              El email viene verificado desde el proveedor y queda bloqueado para este registro.
            </p>
            <p>
              Por ahora, los beneficios automáticos de la web solo consideran suscripciones pagadas de Twitch.
              Los roles TW_VIP y YT_Miembro no se pueden obtener ni entregar beneficios adicionales hasta que Kala autorice su activación (ja!).
            </p>
          </div>
        ) : null}

        {!oauthProvider ? (
          <>
            <div className="auth-provider-row" aria-label="Opciones de registro conectado">
              <a className="auth-provider-button twitch-login-button" href={twitchRegisterHref}>
                <span>Twitch</span>
                <strong>Registrarme</strong>
              </a>
              <a className="auth-provider-button youtube-login-button" href={googleRegisterHref}>
                <span>YouTube</span>
                <strong>Registrarme</strong>
              </a>
            </div>
            <div className="auth-divider">
              <span>O crea una cuenta manual</span>
            </div>
          </>
        ) : null}

        <form
          className="auth-form"
          onSubmit={handleSubmit(submitRegister, () => {
            toast.error("Revisa los campos marcados.");
          })}
          noValidate
        >
          <div className="auth-form-grid">
            <div className="auth-field">
              <label htmlFor="register-login">Usuario</label>
              <input
                id="register-login"
                type="text"
                autoComplete="username"
                maxLength={LOGIN_MAX_LENGTH}
                disabled={isLoadingOAuth}
                aria-invalid={Boolean(errors.login)}
                aria-describedby={errors.login ? "register-login-error" : undefined}
                {...register("login")}
              />
              {errors.login ? <span id="register-login-error" className="auth-field-error">{errors.login.message}</span> : null}
            </div>
            <div className="auth-field">
              <label htmlFor="register-alias">Alias</label>
              <input
                id="register-alias"
                type="text"
                autoComplete="nickname"
                maxLength={ALIAS_MAX_LENGTH}
                disabled={isLoadingOAuth}
                aria-invalid={Boolean(errors.alias)}
                aria-describedby={errors.alias ? "register-alias-error" : undefined}
                {...register("alias")}
              />
              {errors.alias ? <span id="register-alias-error" className="auth-field-error">{errors.alias.message}</span> : null}
            </div>
            <div className="auth-field auth-field-full">
              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                maxLength={EMAIL_MAX_LENGTH}
                readOnly={Boolean(oauthProvider)}
                disabled={isLoadingOAuth}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "register-email-error" : undefined}
                {...register("email")}
              />
              {errors.email ? <span id="register-email-error" className="auth-field-error">{errors.email.message}</span> : null}
            </div>
            {oauthProvider && !showManualAccess ? (
              <div className="auth-manual-access-card auth-field-full">
                <div>
                  <span className="auth-link-notice-eyebrow">Acceso manual opcional</span>
                  <strong>Tu cuenta ya quedará conectada a {providerLabel}.</strong>
                  <p>
                    Agrega una contraseña solo si también quieres entrar con usuario y contraseña.
                    También puedes configurarla después desde tu perfil.
                  </p>
                </div>
                <button type="button" className="auth-manual-access-button" onClick={() => setShowManualAccess(true)}>
                  Agregar contraseña
                </button>
              </div>
            ) : (
              <>
                {oauthProvider ? (
                  <div className="auth-manual-access-head auth-field-full">
                    <div>
                      <span className="auth-link-notice-eyebrow">Acceso manual opcional</span>
                      <p>Completa estos campos solo si también quieres entrar con usuario y contraseña.</p>
                    </div>
                    <button type="button" className="auth-manual-access-clear" onClick={hideManualAccess}>
                      Quitar contraseña
                    </button>
                  </div>
                ) : null}
                <div className="auth-field">
                  <label htmlFor="register-password">{oauthProvider ? "Contraseña opcional" : "Contraseña"}</label>
                  <div className="auth-password-field">
                    <input
                      id="register-password"
                      type={visiblePasswords.password ? "text" : "password"}
                      autoComplete="new-password"
                      maxLength={PASSWORD_MAX_LENGTH}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? "register-password-error" : undefined}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={visiblePasswords.password ? "Ocultar contraseña" : "Mostrar contraseña"}
                      onClick={() => togglePassword("password")}
                    >
                      {visiblePasswords.password ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {showPasswordStrength ? (
                    <div className={`auth-password-strength is-${passwordStrength.tone}`} aria-live="polite">
                      <span className="auth-password-strength-track" aria-hidden="true">
                        <span style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                      </span>
                      <span>{passwordStrength.label}</span>
                    </div>
                  ) : null}
                  {errors.password ? <span id="register-password-error" className="auth-field-error">{errors.password.message}</span> : null}
                </div>
                <div className="auth-field">
                  <label htmlFor="register-confirm">Confirmar contraseña</label>
                  <div className="auth-password-field">
                    <input
                      id="register-confirm"
                      type={visiblePasswords.confirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      maxLength={PASSWORD_MAX_LENGTH}
                      aria-invalid={Boolean(errors.confirmPassword)}
                      aria-describedby={errors.confirmPassword ? "register-confirm-error" : undefined}
                      {...register("confirmPassword")}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={visiblePasswords.confirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      onClick={() => togglePassword("confirmPassword")}
                    >
                      {visiblePasswords.confirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword ? <span id="register-confirm-error" className="auth-field-error">{errors.confirmPassword.message}</span> : null}
                </div>
              </>
            )}
          </div>

          <button type="submit" className="auth-submit-button" disabled={isSubmitting || isLoadingOAuth}>
            {isSubmitting ? <span className="auth-submit-spinner" aria-hidden="true" /> : null}
            <span>{isSubmitting ? "Creando..." : isLoadingOAuth ? "Cargando..." : oauthProvider ? `Finalizar con ${providerLabel}` : "Crear cuenta"}</span>
            {!isSubmitting ? <span aria-hidden="true">→</span> : null}
          </button>
        </form>

        <p className="auth-footer-copy">
          ¿Ya tienes cuenta? <Link href={`/login?returnTo=${encodeURIComponent(nextPath)}`}>Iniciar sesión</Link>
        </p>

        <AuthBackButton fallbackHref="/inicio" returnHref={nextPath} />
      </section>
    </main>
  );
}
