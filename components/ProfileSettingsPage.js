"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Link2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

import AccountMenu from "@/components/AccountMenu";
import AvatarUploader, { uploadAvatarFile } from "@/components/AvatarUploader";
import ConfirmModal from "@/components/ConfirmModal";
import AppSidebar from "@/components/AppSidebar";
import AppSidebarShell from "@/components/AppSidebarShell";
import NotificationCenter from "@/components/NotificationCenter";
import {
  ALIAS_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  getPasswordErrorField,
  getPasswordStrength,
  getProfileErrorField,
  PASSWORD_MAX_LENGTH,
  validatePasswordChangeFields,
  validateProfileFields,
} from "@/lib/platformUserValidation";

const GOD_EXCLUDED_PERMISSION_CODES = new Set(["anime.rating.streamer"]);

function PasswordInput({
  id,
  label,
  field,
  autoComplete,
  value,
  isVisible,
  error,
  onChange,
  onToggle,
  children,
}) {
  return (
    <div className="form-group-modal">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-field">
        <input
          id={id}
          className="modal-input"
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          maxLength={PASSWORD_MAX_LENGTH}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(field, event.target.value)}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => onToggle(field)}
        >
          {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? <span id={`${id}-error`} className="field-error">{error}</span> : null}
      {children}
    </div>
  );
}

export default function ProfileSettingsPage({ currentUser }) {
  const router = useRouter();
  const [user, setUser] = useState(currentUser);
  const [profileForm, setProfileForm] = useState({
    alias: currentUser?.alias || "",
    email: currentUser?.email || "",
    avatarUrl: currentUser?.avatarUrl || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    password: false,
    confirmPassword: false,
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [disconnectProvider, setDisconnectProvider] = useState("");
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const permissions = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
  const canAccess = (permission) => (user?.role === "dios" && !GOD_EXCLUDED_PERMISSION_CODES.has(permission)) || permissions.has(permission);
  const canManageUsers = canAccess("users.read");
  const canManageRoles = canAccess("roles.read");
  const canCreateTracker = canAccess("tracker.create");
  const canUpdateTracker = canAccess("tracker.update");
  const canDeleteTracker = canAccess("tracker.delete");
  const canViewTrackerMaintainer = canAccess("admin.tracker.view");
  const canManageTracker = canViewTrackerMaintainer && (canCreateTracker || canUpdateTracker || canDeleteTracker);
  const canViewTagsMaintainer = canAccess("admin.tags.view");
  const canCreateTrackingAnime = canAccess("anime.tracking.create");
  const canUpdateTrackingAnime = canAccess("anime.tracking.update");
  const canDeleteTrackingAnime = canAccess("anime.tracking.delete");
  const canCreateCompletedAnime = canAccess("anime.completed.create");
  const canUpdateCompletedAnime = canAccess("anime.completed.update");
  const canDeleteCompletedAnime = canAccess("anime.completed.delete");
  const canViewTrackingAnimeMaintainer = canAccess("admin.anime.tracking.view");
  const canViewCompletedAnimeMaintainer = canAccess("admin.anime.completed.view");
  const canManageTrackingAnime = canViewTrackingAnimeMaintainer && (canCreateTrackingAnime || canUpdateTrackingAnime || canDeleteTrackingAnime);
  const canManageCompletedAnime = canViewCompletedAnimeMaintainer && (canCreateCompletedAnime || canUpdateCompletedAnime || canDeleteCompletedAnime);
  const canViewSpaceDrumChaptersMaintainer = canAccess("admin.spacedrum.chapters.view");
  const canViewSpaceDrumPagesMaintainer = canAccess("admin.spacedrum.pages.view");
  const canViewSpaceDrumSettingsMaintainer = canAccess("admin.spacedrum.settings.view");
  const canViewSpaceDrumImportMaintainer = canAccess("admin.spacedrum.import.view");
  const canManageSpaceDrum = canViewSpaceDrumChaptersMaintainer
    || canViewSpaceDrumPagesMaintainer
    || canViewSpaceDrumSettingsMaintainer
    || canViewSpaceDrumImportMaintainer;
  const canViewNotifications = canAccess("notifications.view");
  const canViewAllNotifications = canAccess("notifications.full.view");
  const isAuthenticated = Boolean(user?.id);
  const passwordStrength = getPasswordStrength(passwordForm.password);
  const showPasswordStrength = Boolean(passwordForm.password);
  const canSetInitialPassword = !user?.hasPassword;
  const canChangePassword = user?.hasPassword && user?.role !== "dios";
  const canManagePassword = canSetInitialPassword || canChangePassword;
  const passwordValidationError = validatePasswordChangeFields(passwordForm, { requireCurrentPassword: user?.hasPassword });
  const canSubmitPassword = canManagePassword && !passwordValidationError && !isSavingPassword;
  const identities = user?.authIdentities || [];
  const twitchIdentity = identities.find((identity) => identity.provider === "twitch");
  const googleIdentity = identities.find((identity) => identity.provider === "google");
  const connectedIdentityCount = identities.length;
  const isLastAccessMethod = !user?.hasPassword && connectedIdentityCount <= 1;
  const normalizedProfile = {
    alias: profileForm.alias.trim(),
    email: profileForm.email.trim().toLowerCase(),
    avatarUrl: profileForm.avatarUrl.trim(),
  };
  const hasProfileChanges =
    normalizedProfile.alias !== (user?.alias || "") ||
    normalizedProfile.email !== (user?.email || "") ||
    normalizedProfile.avatarUrl !== (user?.avatarUrl || "") ||
    Boolean(avatarFile);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  useEffect(() => {
    const provider = new URLSearchParams(window.location.search).get("connected");
    if (provider) toast.success(`${provider === "google" ? "Google" : "Twitch"} se conectó a tu cuenta.`);
  }, []);

  function updateProfileField(field, value) {
    setProfileErrors((current) => ({ ...current, [field]: "", form: "" }));
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function updateAvatarFile(file, error = "") {
    setProfileErrors((current) => ({ ...current, avatarUrl: error, form: "" }));
    setAvatarFile(file);
  }

  function clearAvatar() {
    setAvatarFile(null);
    setAvatarPreviewUrl("");
    setProfileForm((current) => ({ ...current, avatarUrl: "" }));
    setProfileErrors((current) => ({ ...current, avatarUrl: "", form: "" }));
  }

  function updatePasswordField(field, value) {
    setPasswordErrors((current) => ({ ...current, [field]: "", form: "" }));
    setPasswordForm((current) => ({ ...current, [field]: value }));
  }

  function togglePassword(field) {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    const validationError = validateProfileFields(profileForm);

    if (validationError) {
      setProfileErrors({ [getProfileErrorField(validationError)]: validationError });
      return;
    }

    if (!hasProfileChanges) {
      setProfileErrors({ form: "No hay cambios para guardar." });
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profile",
          profile: {
            alias: profileForm.alias.trim(),
            email: profileForm.email.trim().toLowerCase(),
            avatarUrl: avatarFile ? await uploadAvatarFile(avatarFile) : profileForm.avatarUrl.trim(),
          },
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo actualizar el perfil.");
      }

      setUser(data.user);
      setProfileForm({
        alias: data.user.alias || "",
        email: data.user.email || "",
        avatarUrl: data.user.avatarUrl || "",
      });
      setAvatarFile(null);
      setAvatarPreviewUrl("");
      setProfileErrors({});
      toast.success("Perfil actualizado.");
      router.refresh();
    } catch (error) {
      const errorField = getProfileErrorField(error.message);
      setProfileErrors({ [errorField]: error.message });
      if (errorField === "form") {
        toast.error(error.message);
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    const validationError = validatePasswordChangeFields(passwordForm, { requireCurrentPassword: user?.hasPassword });

    if (validationError) {
      setPasswordErrors({ [getPasswordErrorField(validationError)]: validationError });
      return;
    }

    setIsSavingPassword(true);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "password", password: passwordForm }),
      });
      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar la contraseña.");
      }

      setUser(data.user);
      setPasswordForm({ currentPassword: "", password: "", confirmPassword: "" });
      setPasswordErrors({});
      toast.success(canSetInitialPassword ? "Contraseña configurada." : "Contraseña actualizada.");
    } catch (error) {
      const errorField = getPasswordErrorField(error.message);
      setPasswordErrors({ [errorField]: error.message });
      if (errorField === "form") {
        toast.error(error.message);
      }
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function disconnectIdentity() {
    if (!disconnectProvider) return;
    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "identity-disconnect", provider: disconnectProvider }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo desconectar la cuenta.");
      setUser(data.user);
      setDisconnectProvider("");
      toast.success("Cuenta externa desconectada.");
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <div className="bg-orb orb-1" aria-hidden="true" />
      <div className="bg-orb orb-2" aria-hidden="true" />
      <div className="bg-orb orb-3" aria-hidden="true" />

      <AppSidebarShell>
        <AppSidebar
          activeView=""
          canManageUsers={canManageUsers}
          canManageRoles={canManageRoles}
          canManageTracker={canManageTracker}
          canManageTags={canViewTagsMaintainer}
          canManageSpaceDrum={canManageSpaceDrum}
          canManageAnimeTracking={canManageTrackingAnime}
          canManageAnimeCompleted={canManageCompletedAnime}
          isAuthenticated={isAuthenticated}
          canAccess={canAccess}
        />

        <div className="content-shell">
          <header className="topbar" aria-label="Barra superior">
            <div className="topbar-title">
              <span className="topbar-kicker">Cuenta</span>
              <span className="topbar-page">Configurar perfil</span>
            </div>
            <div className="topbar-actions">
              {canViewNotifications ? <NotificationCenter user={user} canViewAll={canViewAllNotifications} /> : null}
              <AccountMenu user={user} canManageUsers={canManageUsers} />
            </div>
          </header>

          <main className="app-wrapper profile-settings-page">
            <header className="watching-header admin-users-header profile-page-header">
              <h1 className="title">
                Configurar <span className="text-gradient">perfil</span>
              </h1>
              <p className="subtitle">Actualiza la información visible de tu cuenta y tus credenciales.</p>
            </header>

            <section className="profile-settings-grid">
              <div className="profile-primary-column">
                <form className="profile-settings-card profile-account-card" onSubmit={saveProfile} noValidate>
                  <div className="profile-settings-card-header">
                    <div>
                      <span className="tracker-actions-label">Información</span>
                      <h2>Datos de cuenta</h2>
                    </div>
                    <span className="admin-user-status is-active">{user?.roleLabel || "Usuario"}</span>
                  </div>

                  <AvatarUploader
                    avatarUrl={profileForm.avatarUrl}
                    alias={profileForm.alias}
                    login={user?.login}
                    previewUrl={avatarPreviewUrl}
                    error={profileErrors.avatarUrl}
                    onFileChange={updateAvatarFile}
                    onAvatarClear={clearAvatar}
                  />

                  <div className="profile-account-meta" aria-label="Resumen de cuenta">
                    <div>
                      <span>Usuario</span>
                      <strong>{user?.login || "Sin usuario"}</strong>
                    </div>
                    <div>
                      <span>Rol</span>
                      <strong>{user?.roleLabel || "Usuario"}</strong>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group-modal">
                      <label htmlFor="profile-alias">Alias</label>
                      <input
                        id="profile-alias"
                        className="modal-input"
                        value={profileForm.alias}
                        maxLength={ALIAS_MAX_LENGTH}
                        onChange={(event) => updateProfileField("alias", event.target.value)}
                        autoComplete="nickname"
                        aria-invalid={Boolean(profileErrors.alias)}
                        aria-describedby={profileErrors.alias ? "profile-alias-error" : undefined}
                      />
                      {profileErrors.alias ? <span id="profile-alias-error" className="field-error">{profileErrors.alias}</span> : null}
                    </div>
                    <div className="form-group-modal">
                      <label htmlFor="profile-email">Email</label>
                      <input
                        id="profile-email"
                        className="modal-input"
                        type="email"
                        value={profileForm.email}
                        maxLength={EMAIL_MAX_LENGTH}
                        onChange={(event) => updateProfileField("email", event.target.value)}
                        autoComplete="email"
                        aria-invalid={Boolean(profileErrors.email)}
                        aria-describedby={profileErrors.email ? "profile-email-error" : undefined}
                      />
                      {profileErrors.email ? <span id="profile-email-error" className="field-error">{profileErrors.email}</span> : null}
                    </div>
                  </div>

                  {profileErrors.form ? <p className="field-error">{profileErrors.form}</p> : null}

                  <div className="modal-actions">
                    <button type="submit" className="btn-modal btn-modal-primary" disabled={isSavingProfile || !hasProfileChanges}>
                      {isSavingProfile ? "Guardando..." : "Guardar perfil"}
                    </button>
                  </div>
                </form>

                <form className="profile-settings-card profile-password-card" onSubmit={savePassword} noValidate>
                  <div className="profile-settings-card-header">
                    <div>
                      <span className="tracker-actions-label">Seguridad</span>
                      <h2>{canSetInitialPassword ? "Configurar contraseña" : "Contraseña"}</h2>
                      <p>
                        {canSetInitialPassword
                          ? "Crea una contraseña para mantener acceso manual si desconectas tus cuentas externas."
                          : "Cambia tu contraseña usando tu clave actual."}
                      </p>
                    </div>
                  </div>

                  {canManagePassword ? (
                    <>
                      {user?.hasPassword ? (
                        <PasswordInput
                          id="profile-current-password"
                          label="Contraseña actual"
                          field="currentPassword"
                          autoComplete="current-password"
                          value={passwordForm.currentPassword}
                          isVisible={visiblePasswords.currentPassword}
                          error={passwordErrors.currentPassword}
                          onChange={updatePasswordField}
                          onToggle={togglePassword}
                        />
                      ) : null}
                      <PasswordInput
                        id="profile-new-password"
                        label={canSetInitialPassword ? "Contraseña" : "Nueva contraseña"}
                        field="password"
                        autoComplete="new-password"
                        value={passwordForm.password}
                        isVisible={visiblePasswords.password}
                        error={passwordErrors.password}
                        onChange={updatePasswordField}
                        onToggle={togglePassword}
                      >
                        {showPasswordStrength ? (
                          <div className={`auth-password-strength profile-password-strength is-${passwordStrength.tone}`} aria-live="polite">
                            <span className="auth-password-strength-track" aria-hidden="true">
                              <span style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                            </span>
                            <span>{passwordStrength.label}</span>
                          </div>
                        ) : null}
                      </PasswordInput>
                      <PasswordInput
                        id="profile-confirm-password"
                        label="Confirmar contraseña"
                        field="confirmPassword"
                        autoComplete="new-password"
                        value={passwordForm.confirmPassword}
                        isVisible={visiblePasswords.confirmPassword}
                        error={passwordErrors.confirmPassword}
                        onChange={updatePasswordField}
                        onToggle={togglePassword}
                      />
                      {passwordErrors.form ? <p className="field-error">{passwordErrors.form}</p> : null}
                      <div className="modal-actions">
                        <button type="submit" className="btn-modal btn-modal-primary" disabled={!canSubmitPassword}>
                          {isSavingPassword ? "Guardando..." : canSetInitialPassword ? "Configurar contraseña" : "Cambiar contraseña"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="profile-settings-note">
                      Esta cuenta no permite cambio de contraseña desde el perfil.
                    </p>
                  )}
                </form>
              </div>

              <section className="profile-settings-card profile-identities-card">
                <div className="profile-settings-card-header">
                  <div>
                    <span className="tracker-actions-label">Acceso</span>
                    <h2>Cuentas conectadas</h2>
                    <p>Usa cualquiera de estos métodos para entrar a la misma cuenta.</p>
                  </div>
                </div>

                <div className="profile-identity-list">
                  {[
                    { provider: "twitch", label: "Twitch", identity: twitchIdentity },
                    { provider: "google", label: "Google / YouTube", identity: googleIdentity },
                  ].map(({ provider, label, identity }) => {
                    const cannotDisconnectLastMethod = Boolean(identity && isLastAccessMethod);
                    return (
                      <div className="profile-identity-row" key={provider}>
                        <div className="profile-identity-copy">
                          <strong>{label}</strong>
                          <span>{identity ? identity.email || identity.login || "Cuenta conectada" : "No conectado"}</span>
                          {cannotDisconnectLastMethod ? (
                            <small>Configura una contraseña antes de desconectar tu último método de acceso.</small>
                          ) : null}
                        </div>
                        {identity ? (
                          <button
                            type="button"
                            className="btn-modal btn-modal-secondary"
                            disabled={cannotDisconnectLastMethod}
                            onClick={() => setDisconnectProvider(provider)}
                          >
                            <Unlink size={16} aria-hidden="true" />
                            Desconectar
                          </button>
                        ) : (
                          <a className="btn-modal btn-modal-primary" href={`/api/auth/${provider}/start?intent=connect&returnTo=%2Fperfil`}>
                            <Link2 size={16} aria-hidden="true" />
                            Conectar
                          </a>
                        )}
                      </div>
                    );
                  })}
                  <p className="profile-settings-note profile-benefit-note">
                    Por ahora, los beneficios automáticos de la web solo consideran suscripciones pagadas de Twitch.
                    Los roles TW_VIP y YT_Miembro no se pueden obtener ni entregar beneficios adicionales hasta que Kala autorice su activación (ja!).
                  </p>
                  <div className="profile-identity-row">
                    <div className="profile-identity-copy">
                      <strong>Usuario y contraseña</strong>
                      <span>{user?.hasPassword ? "Configurado" : "No configurado"}</span>
                    </div>
                  </div>
                </div>
              </section>

            </section>
          </main>
        </div>
      </AppSidebarShell>
      <ConfirmModal
        isOpen={Boolean(disconnectProvider)}
        title="Desconectar cuenta"
        description="Después de desconectarla ya no podrás usar este proveedor para iniciar sesión. No se eliminará tu perfil ni tu actividad."
        confirmLabel="Desconectar"
        isLoading={isDisconnecting}
        onConfirm={disconnectIdentity}
        onCancel={() => setDisconnectProvider("")}
      />
    </>
  );
}
