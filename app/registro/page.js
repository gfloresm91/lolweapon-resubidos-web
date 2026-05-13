"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Toaster, toast } from "sonner";
import { z } from "zod";

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

const registerSchema = z.object({
  login: LOGIN_RULES,
  alias: ALIAS_RULES,
  email: EMAIL_RULES,
  password: PASSWORD_RULES,
  confirmPassword: z
    .string()
    .min(1, "Confirma tu contraseña.")
    .max(72, "La confirmación no puede superar 72 caracteres."),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Las contraseñas no coinciden.",
});

export default function RegisterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      password: "",
      confirmPassword: "",
    },
  });
  const passwordStrength = getPasswordStrength(watch("password"));

  function togglePassword(field) {
    setVisiblePasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
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

      router.push("/");
      router.refresh();
    } catch {
      toast.error("No se pudo crear la cuenta. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <Toaster position="top-right" richColors closeButton />
      <section className="auth-card auth-card-wide" aria-labelledby="register-title">
        <div className="auth-header">
          <span className="auth-brand" aria-hidden="true">
            <img src="/brand/lolweapon-logo.png" alt="" />
            <strong>LOLWEAPON</strong>
          </span>
          <h1 id="register-title" className="auth-title">Crear cuenta</h1>
          <p className="auth-subtitle">Crea un usuario manual para entrar a la plataforma.</p>
        </div>

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
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "register-email-error" : undefined}
                {...register("email")}
              />
              {errors.email ? <span id="register-email-error" className="auth-field-error">{errors.email.message}</span> : null}
            </div>
            <div className="auth-field">
              <label htmlFor="register-password">Contraseña</label>
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
              <div className={`auth-password-strength is-${passwordStrength.tone}`} aria-live="polite">
                <span className="auth-password-strength-track" aria-hidden="true">
                  <span style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                </span>
                <span>{passwordStrength.label}</span>
              </div>
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
          </div>

          <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
            {isSubmitting ? <span className="auth-submit-spinner" aria-hidden="true" /> : null}
            <span>{isSubmitting ? "Creando..." : "Crear cuenta"}</span>
            {!isSubmitting ? <span aria-hidden="true">→</span> : null}
          </button>
        </form>

        <p className="auth-footer-copy">
          ¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link>
        </p>

        <Link href="/" className="auth-back-link">
          <span aria-hidden="true">←</span>
          Volver a la web
        </Link>
      </section>
    </main>
  );
}
