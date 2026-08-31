"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit3, Eye, EyeOff, History, KeyRound, Plus, Power, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import AvatarUploader, { uploadAvatarFile } from "@/components/AvatarUploader";
import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";
import Tooltip from "@/components/Tooltip";
import {
  ALIAS_MAX_LENGTH,
  ALIAS_RULES,
  EMAIL_MAX_LENGTH,
  EMAIL_RULES,
  getPasswordStrength,
  getProfileErrorField,
  LOGIN_MAX_LENGTH,
  LOGIN_RULES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_RULES,
} from "@/lib/platformUserValidation";

const EMPTY_USER = {
  login: "",
  twitchUserId: "",
  alias: "",
  email: "",
  avatarUrl: "",
  role: "publico",
  isActive: true,
};

const FALLBACK_ROLES = [
  { code: "dios", label: "Dios", canAdmin: true },
  { code: "admin", label: "Admin", canAdmin: true },
  { code: "moderador", label: "Moderador", canAdmin: true },
  { code: "tw-tier-1", label: "TW_Tier 1", canAdmin: false },
  { code: "tw-tier-2", label: "TW_Tier 2", canAdmin: false },
  { code: "tw-tier-3", label: "TW_Tier 3", canAdmin: false },
  { code: "tw-vip", label: "TW_VIP", canAdmin: false },
  { code: "yt-miembro", label: "YT_Miembro", canAdmin: false },
  { code: "publico", label: "Público", canAdmin: false },
];

const TABLE_COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "alias", label: "Alias", sortable: true },
  { key: "login", label: "Usuario", sortable: true },
  { key: "email", label: "Email", sortable: true },
  { key: "role", label: "Rol", sortable: true },
  { key: "lastLoginAt", label: "Último login", sortable: true },
  { key: "origin", label: "Origen", sortable: true },
  { key: "twitch", label: "Twitch" },
  { key: "twitchRoleSyncedAt", label: "Sync", sortable: true },
  { key: "isActive", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const adminUserBaseSchema = z.object({
  id: z.number().optional(),
  twitchUserId: z.string().optional(),
  login: LOGIN_RULES,
  alias: ALIAS_RULES,
  email: EMAIL_RULES,
  avatarUrl: z.string().trim(),
  role: z.string().min(1, "Selecciona un rol."),
  isActive: z.boolean(),
  password: z.string(),
  confirmPassword: z.string(),
}).superRefine((values, context) => {
  const isEditing = Boolean(values.id);
  const shouldValidatePassword = !isEditing || values.password || values.confirmPassword;

  if (!shouldValidatePassword) {
    return;
  }

  const passwordResult = PASSWORD_RULES.safeParse(values.password);

  if (!passwordResult.success) {
    for (const issue of passwordResult.error.issues) {
      context.addIssue({ ...issue, path: ["password"] });
    }
  }

  if (!values.confirmPassword) {
    context.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "Confirma tu contraseña.",
    });
    return;
  }

  if (values.confirmPassword.length > 72) {
    context.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "La confirmación no puede superar 72 caracteres.",
    });
  }

  if (values.password !== values.confirmPassword) {
    context.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "Las contraseñas no coinciden.",
    });
  }
});

function formatDate(value) {
  if (!value) {
    return "Nunca";
  }

  const parts = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Santiago",
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = byType.day || "00";
  const month = byType.month || "00";
  const year = byType.year || "0000";
  const hours = byType.hour || "00";
  const minutes = byType.minute || "00";

  return `${day}-${month}-${year}, ${hours}:${minutes}`;
}

function getUserOrigin(user) {
  return user?.twitchUserId ? "twitch" : "manual";
}

function getTwitchBadges(user) {
  const badges = [];

  if (user?.isTwitchModerator) {
    badges.push({ key: "mod", label: "MOD", tone: "mod" });
  }

  if (user?.isTwitchVip) {
    badges.push({ key: "vip", label: "VIP", tone: "vip" });
  }

  if (user?.twitchSubscriberTier === "3000") {
    badges.push({ key: "tier-3", label: "Tier 3", tone: "tier" });
  } else if (user?.twitchSubscriberTier === "2000") {
    badges.push({ key: "tier-2", label: "Tier 2", tone: "tier" });
  } else if (user?.twitchSubscriberTier === "1000") {
    badges.push({ key: "tier-1", label: "Tier 1", tone: "tier" });
  }

  return badges;
}

function getSortValue(user, sortKey) {
  if (sortKey === "id") {
    return user.id || 0;
  }

  if (sortKey === "role") {
    return user.roleLabel || user.role || "";
  }

  if (sortKey === "isActive") {
    return user.isActive ? 1 : 0;
  }

  if (sortKey === "lastLoginAt") {
    return user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
  }

  if (sortKey === "twitchRoleSyncedAt") {
    return user.twitchRoleSyncedAt ? new Date(user.twitchRoleSyncedAt).getTime() : 0;
  }

  if (sortKey === "origin") {
    return getUserOrigin(user);
  }

  if (sortKey === "login") {
    return String(user.login || "").toLowerCase();
  }

  if (sortKey === "email") {
    return String(user.email || "").toLowerCase();
  }

  return String(user.alias || user.login || "").toLowerCase();
}

function normalizeDraft(user) {
  return {
    ...EMPTY_USER,
    ...user,
    twitchUserId: user?.twitchUserId || "",
    email: user?.email || "",
    avatarUrl: user?.avatarUrl || "",
    isActive: user?.isActive !== false,
    password: "",
    confirmPassword: "",
  };
}

function PlatformUserModal({ user, editableRoles, isSaving, onCancel, onSubmit }) {
  const isTwitchUser = Boolean(user.twitchUserId);
  const isCreating = !user.id;
  const isGodUser = user.role === "dios";
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({
    password: false,
    confirmPassword: false,
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(adminUserBaseSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: normalizeDraft(user),
  });
  const passwordStrength = getPasswordStrength(watch("password"));
  const showPasswordStrength = Boolean(watch("password"));
  const watchedAlias = watch("alias");
  const watchedLogin = watch("login");
  const watchedAvatarUrl = watch("avatarUrl");

  useEffect(() => {
    reset(normalizeDraft(user));
    setAvatarFile(null);
    setAvatarPreviewUrl("");
    setAvatarError("");
  }, [reset, user]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  function togglePassword(field) {
    setVisiblePasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
  }

  function updateAvatarFile(file, error = "") {
    setAvatarError(error);
    setAvatarFile(file);
  }

  function clearAvatar() {
    setAvatarFile(null);
    setAvatarPreviewUrl("");
    setAvatarError("");
    setValue("avatarUrl", "", { shouldDirty: true, shouldValidate: true });
  }

  async function submitForm(values) {
    if (avatarError) {
      return;
    }

    try {
      const avatarUrl = avatarFile ? await uploadAvatarFile(avatarFile) : values.avatarUrl.trim();
      const payload = {
        ...values,
        login: values.login.trim().toLowerCase(),
        alias: values.alias.trim(),
        email: values.email.trim().toLowerCase(),
        avatarUrl,
      };

      setValue("login", payload.login);
      setValue("alias", payload.alias);
      setValue("email", payload.email);
      setValue("avatarUrl", payload.avatarUrl);
      await onSubmit(payload);
    } catch (error) {
      const errorField = getProfileErrorField(error.message);
      if (errorField === "avatarUrl") {
        setAvatarError(error.message);
        return;
      }

      if (["login", "alias", "email"].includes(errorField)) {
        setError(errorField, { type: "server", message: error.message });
        return;
      }

      toast.error(error.message);
    }
  }

  return (
    <MaintainerModal
      as="form"
      title={user.id ? "Editar usuario" : "Nuevo usuario"}
      onClose={onCancel}
      onSubmit={handleSubmit(submitForm, () => {
          if (avatarError) {
            return;
          }
        })}
      noValidate
      actions={(
        <>
          <button type="button" className="btn-modal btn-modal-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </>
      )}
    >
        {isTwitchUser ? (
          <p className="admin-modal-notice">
            Este usuario está vinculado a Twitch. Usuario, email y estado Twitch pueden actualizarse al iniciar sesión.
          </p>
        ) : null}
        <div className="admin-modal-section">
          <h3>Identidad</h3>
        <div className="form-row">
          <div className="form-group-modal">
            <label htmlFor="platform-user-login">Usuario</label>
            <input
              id="platform-user-login"
              className="modal-input"
              autoComplete="username"
              maxLength={LOGIN_MAX_LENGTH}
              aria-invalid={Boolean(errors.login)}
              aria-describedby={errors.login ? "platform-user-login-error" : undefined}
              readOnly={isTwitchUser}
              {...register("login")}
            />
            {errors.login ? <span id="platform-user-login-error" className="field-error">{errors.login.message}</span> : null}
          </div>
          <div className="form-group-modal">
            <label htmlFor="platform-user-alias">Alias</label>
            <input
              id="platform-user-alias"
              className="modal-input"
              autoComplete="nickname"
              maxLength={ALIAS_MAX_LENGTH}
              aria-invalid={Boolean(errors.alias)}
              aria-describedby={errors.alias ? "platform-user-alias-error" : undefined}
              {...register("alias")}
            />
            {errors.alias ? <span id="platform-user-alias-error" className="field-error">{errors.alias.message}</span> : null}
          </div>
        </div>

        <div className="form-group-modal">
          <label htmlFor="platform-user-email">Email</label>
          <input
            id="platform-user-email"
            className="modal-input"
            type="email"
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "platform-user-email-error" : undefined}
            readOnly={isTwitchUser}
            {...register("email")}
          />
          {errors.email ? <span id="platform-user-email-error" className="field-error">{errors.email.message}</span> : null}
        </div>
        </div>

        <div className="admin-modal-section">
          <h3>Perfil</h3>
          <AvatarUploader
            avatarUrl={watchedAvatarUrl}
            alias={watchedAlias}
            login={watchedLogin}
            previewUrl={avatarPreviewUrl}
            error={avatarError}
            onFileChange={updateAvatarFile}
            onAvatarClear={clearAvatar}
          />
        </div>

        {isCreating ? (
        <div className="admin-modal-section">
          <h3>Acceso</h3>
        <div className="form-row">
          <div className="form-group-modal">
            <label htmlFor="platform-user-password">{user.id ? "Nueva contraseña" : "Contraseña"}</label>
            <div className="auth-password-field">
              <input
                id="platform-user-password"
                className="modal-input"
                type={visiblePasswords.password ? "text" : "password"}
                autoComplete="new-password"
                maxLength={PASSWORD_MAX_LENGTH}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "platform-user-password-error" : undefined}
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
              <div className={`auth-password-strength profile-password-strength is-${passwordStrength.tone}`} aria-live="polite">
                <span className="auth-password-strength-track" aria-hidden="true">
                  <span style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                </span>
                <span>{passwordStrength.label}</span>
              </div>
            ) : null}
            {errors.password ? <span id="platform-user-password-error" className="field-error">{errors.password.message}</span> : null}
          </div>
          <div className="form-group-modal">
            <label htmlFor="platform-user-confirm">Confirmar contraseña</label>
            <div className="auth-password-field">
              <input
                id="platform-user-confirm"
                className="modal-input"
                type={visiblePasswords.confirmPassword ? "text" : "password"}
                autoComplete="new-password"
                maxLength={PASSWORD_MAX_LENGTH}
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? "platform-user-confirm-error" : undefined}
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
            {errors.confirmPassword ? <span id="platform-user-confirm-error" className="field-error">{errors.confirmPassword.message}</span> : null}
          </div>
        </div>
        </div>
        ) : null}

        <div className="admin-modal-section">
          <h3>Rol</h3>
        <div className="form-group-modal">
          <FilterSelect
            id="platform-user-role"
            label="Rol"
            value={watch("role")}
            options={(isGodUser ? editableRoles.filter((role) => role.code === "dios") : editableRoles).map((role) => ({
              value: role.code,
              label: `${role.label}${role.canAdmin ? " · admin" : ""}`,
            }))}
            disabled={isGodUser}
            disabledHint="El usuario Dios no puede cambiar de rol."
            onChange={(role) => setValue("role", role, { shouldDirty: true, shouldValidate: true })}
          />
          {isGodUser ? <span className="field-help">El rol Dios es inmutable.</span> : null}
          {errors.role ? <span className="field-error">{errors.role.message}</span> : null}
        </div>
        </div>

    </MaintainerModal>
  );
}

function PlatformPasswordModal({ user, isSaving, onCancel, onSubmit }) {
  const [visiblePasswords, setVisiblePasswords] = useState({
    password: false,
    confirmPassword: false,
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm({
    resolver: zodResolver(z.object({
      password: PASSWORD_RULES,
      confirmPassword: z
        .string()
        .min(1, "Confirma tu contraseña.")
        .max(72, "La confirmación no puede superar 72 caracteres."),
    }).refine((values) => values.password === values.confirmPassword, {
      path: ["confirmPassword"],
      message: "Las contraseñas no coinciden.",
    })),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });
  const passwordStrength = getPasswordStrength(watch("password"));
  const showPasswordStrength = Boolean(watch("password"));

  function togglePassword(field) {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  }

  function submitPassword(values) {
    onSubmit({ ...normalizeDraft(user), password: values.password, confirmPassword: values.confirmPassword });
  }

  return (
    <MaintainerModal
      as="form"
      className="confirm-modal"
      title="Cambiar contraseña"
      onClose={onCancel}
      onSubmit={handleSubmit(submitPassword)}
      noValidate
      actions={(
        <>
          <button type="button" className="btn-modal btn-modal-secondary" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar contraseña"}
          </button>
        </>
      )}
    >
        <p className="confirm-copy">Define una nueva contraseña para {user.alias || user.login}.</p>
        <div className="form-group-modal">
          <label htmlFor="platform-password-new">Nueva contraseña</label>
          <div className="auth-password-field">
            <input
              id="platform-password-new"
              className="modal-input"
              type={visiblePasswords.password ? "text" : "password"}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <button type="button" className="auth-password-toggle" aria-label={visiblePasswords.password ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => togglePassword("password")}>
              {visiblePasswords.password ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {showPasswordStrength ? (
            <div className={`auth-password-strength profile-password-strength is-${passwordStrength.tone}`} aria-live="polite">
              <span className="auth-password-strength-track" aria-hidden="true">
                <span style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
              </span>
              <span>{passwordStrength.label}</span>
            </div>
          ) : null}
          {errors.password ? <span className="field-error">{errors.password.message}</span> : null}
        </div>
        <div className="form-group-modal">
          <label htmlFor="platform-password-confirm">Confirmar contraseña</label>
          <div className="auth-password-field">
            <input
              id="platform-password-confirm"
              className="modal-input"
              type={visiblePasswords.confirmPassword ? "text" : "password"}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register("confirmPassword")}
            />
            <button type="button" className="auth-password-toggle" aria-label={visiblePasswords.confirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => togglePassword("confirmPassword")}>
              {visiblePasswords.confirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword.message}</span> : null}
        </div>
    </MaintainerModal>
  );
}

export default function PlatformUsersPage({ initialUsers = [], initialRoles = FALLBACK_ROLES, currentUser = null }) {
  const [users, setUsers] = useState(initialUsers);
  const [roles, setRoles] = useState(initialRoles.length ? initialRoles : FALLBACK_ROLES);
  const [isLoadingUsers, setIsLoadingUsers] = useState(!initialUsers.length);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [statusUser, setStatusUser] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.isActive).length,
    admins: users.filter((user) => user.roleCanAdmin).length,
    twitch: users.filter((user) => getUserOrigin(user) === "twitch").length,
    manual: users.filter((user) => getUserOrigin(user) === "manual").length,
    mods: users.filter((user) => user.isTwitchModerator).length,
    vips: users.filter((user) => user.isTwitchVip).length,
    subs: users.filter((user) => user.twitchSubscriberTier).length,
  }), [users]);
  const rolesByCode = useMemo(() => new Map(roles.map((role) => [role.code, role])), [roles]);
  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return users
      .filter((user) => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          user.id,
          user.alias,
          user.login,
          user.login ? `@${user.login}` : "",
          user.email,
          user.roleLabel,
          user.role,
          formatDate(user.lastLoginAt),
          getUserOrigin(user),
          getUserOrigin(user) === "twitch" ? "Twitch" : "Manual",
          ...getTwitchBadges(user).map((badge) => badge.label),
          user.twitchRoleSyncedAt ? formatDate(user.twitchRoleSyncedAt) : "",
          user.isActive ? "Activo" : "Inactivo",
        ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
      })
      .filter((user) => roleFilter === "all" || user.role === roleFilter)
      .filter((user) => {
        if (statusFilter === "active") {
          return user.isActive;
        }

        if (statusFilter === "inactive") {
          return !user.isActive;
        }

        return true;
      })
      .filter((user) => originFilter === "all" || getUserOrigin(user) === originFilter)
      .sort((left, right) => {
        const leftValue = getSortValue(left, sortConfig.key);
        const rightValue = getSortValue(right, sortConfig.key);
        const direction = sortConfig.direction === "asc" ? 1 : -1;

        if (typeof leftValue === "number" && typeof rightValue === "number") {
          return (leftValue - rightValue) * direction;
        }

        return String(leftValue).localeCompare(String(rightValue), "es", { numeric: true }) * direction;
      });
  }, [originFilter, roleFilter, searchQuery, sortConfig.direction, sortConfig.key, statusFilter, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginationFrom = filteredUsers.length ? ((currentPage - 1) * pageSize) + 1 : 0;
  const paginationTo = Math.min(currentPage * pageSize, filteredUsers.length);
  const currentUserIsGod = currentUser?.role === "dios";
  const godUser = users.find((user) => user.role === "dios");
  const editableRoles = useMemo(() => roles.filter((role) => {
    if (role.code !== "dios") {
      return true;
    }

    return currentUserIsGod && (!godUser || editingUser?.id === godUser.id);
  }), [currentUserIsGod, editingUser?.id, godUser, roles]);

  function canEditUser(user) {
    return currentUserIsGod || user.role !== "dios";
  }

  function isGodUser(user) {
    return user?.role === "dios";
  }

  function canRunInternalOperations(user) {
    return canEditUser(user) && !isGodUser(user);
  }

  function toggleSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [originFilter, roleFilter, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    if (initialRoles.length) {
      setRoles(initialRoles);
    }
  }, [initialRoles]);

  useEffect(() => {
    if (initialUsers.length) {
      setIsLoadingUsers(false);
      return undefined;
    }

    let isMounted = true;

    async function loadPlatformUsers() {
      setIsLoadingUsers(true);

      try {
        const response = await fetch("/api/platform-users", { cache: "no-store" });
        const data = await response.json();

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || "No se pudieron cargar los usuarios.");
        }

        if (isMounted) {
          setUsers(data.users || []);
          if (data.roles?.length) {
            setRoles(data.roles);
          }
        }
      } catch (error) {
        if (isMounted) {
          toast.error(error.message || "No se pudieron cargar los usuarios.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false);
        }
      }
    }

    loadPlatformUsers();

    return () => {
      isMounted = false;
    };
  }, [initialUsers.length]);

  async function persistUser(userPayload) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/platform-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: userPayload.id ? "update" : "create",
          user: userPayload,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el usuario.");
      }

      setUsers(data.users || []);
      if (data.roles?.length) {
        setRoles(data.roles);
      }
      setEditingUser(null);
      setPasswordUser(null);
      setStatusUser(null);
      toast.success("Usuario guardado.");
    } catch (error) {
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteUser() {
    if (!pendingDelete) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/platform-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: pendingDelete.id }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el usuario.");
      }

      setUsers(data.users || []);
      if (data.roles?.length) {
        setRoles(data.roles);
      }
      setPendingDelete(null);
      toast.success("Usuario eliminado.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!statusUser) {
      return;
    }

    const nextStatus = !statusUser.isActive;
    setIsSaving(true);

    try {
      const response = await fetch("/api/platform-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-status",
          id: statusUser.id,
          isActive: nextStatus,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar el estado del usuario.");
      }

      setUsers(data.users || []);
      if (data.roles?.length) {
        setRoles(data.roles);
      }
      setStatusUser(null);
      toast.success(nextStatus ? "Usuario activado." : "Usuario desactivado.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="watching-header admin-users-header">
        <h1 className="title">
          Usuarios de <span className="text-gradient">la plataforma</span>
        </h1>
        <p className="subtitle">Administra quienes pueden entrar con Twitch y operar el panel.</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Usuarios", value: stats.total, color: "purple" },
          { label: "Activos", value: stats.active, color: "green" },
          { label: "Admin", value: stats.admins, color: "blue", detail: "con permiso" },
          { label: "Twitch", value: stats.twitch, color: "purple" },
          { label: "Subs", value: stats.subs, color: "green" },
          { label: "MOD/VIP", value: stats.mods + stats.vips, color: "blue" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones de usuarios">
        <div>
          <span className="tracker-actions-label">Administración</span>
          <p className="tracker-actions-copy">Crea usuarios antes de que inicien sesión con Twitch o ajusta sus permisos.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
          <button type="button" className="tracker-action-primary" onClick={() => setEditingUser(EMPTY_USER)}>
            <Plus size={18} />
            Nuevo usuario
          </button>
        </div>
      </section>

      <MaintainerToolbar
        searchId="admin-users-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar ID, alias, usuario, email, rol, origen, Twitch o estado"
        onSearchChange={setSearchQuery}
      >
        <FilterSelect
          id="admin-users-role-filter"
          label="Rol"
          value={roleFilter}
          options={[{ value: "all", label: "Todos los roles" }, ...roles.map((role) => ({ value: role.code, label: role.label }))]}
          onChange={setRoleFilter}
        />
        <FilterSelect
          id="admin-users-status-filter"
          label="Estado"
          value={statusFilter}
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Activos" },
            { value: "inactive", label: "Inactivos" },
          ]}
          onChange={setStatusFilter}
        />
        <FilterSelect
          id="admin-users-origin-filter"
          label="Origen"
          value={originFilter}
          options={[
            { value: "all", label: "Todos" },
            { value: "twitch", label: "Twitch" },
            { value: "manual", label: "Manual" },
          ]}
          onChange={setOriginFilter}
        />
      </MaintainerToolbar>

      <MaintainerTable
        ariaLabel="Usuarios de la plataforma"
        className="admin-users-table"
        columns={TABLE_COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isLoading={isLoadingUsers}
        loadingText="Cargando usuarios..."
        isEmpty={!filteredUsers.length}
        emptyText={users.length ? "No hay usuarios que coincidan con los filtros." : "Todavía no hay usuarios registrados."}
        pagination={{
          from: paginationFrom,
          to: paginationTo,
          total: filteredUsers.length,
          canPrevious: currentPage > 1,
          canNext: currentPage < totalPages,
          pageSize,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageSizeChange: (nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          },
          onPrevious: () => setCurrentPage((page) => Math.max(1, page - 1)),
          onNext: () => setCurrentPage((page) => Math.min(totalPages, page + 1)),
        }}
      >
          {paginatedUsers.map((user) => {
            const twitchBadges = getTwitchBadges(user);

            return (
            <div className="maintainer-table-row admin-users-row" role="row" key={user.id}>
              <span className="admin-user-cell admin-record-id">#{user.id || "-"}</span>
              <div className="admin-user-cell admin-user-profile">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <span className="admin-user-avatar">{(user.alias || user.login).slice(0, 2).toUpperCase()}</span>
                )}
                <strong>{user.alias}</strong>
              </div>
              <span className="admin-user-cell admin-user-login">@{user.login}</span>
              <span className="admin-user-cell admin-user-email">{user.email || "-"}</span>
              <span className="admin-user-cell">
                {user.roleLabel || rolesByCode.get(user.role)?.label || user.role}
              </span>
              <span className="admin-user-cell">{formatDate(user.lastLoginAt)}</span>
              <span className="admin-user-cell">
                {getUserOrigin(user) === "twitch" ? (
                  <span className="admin-user-origin is-twitch">Twitch</span>
                ) : (
                  <span className="admin-user-origin">Manual</span>
                )}
              </span>
              <span className="admin-user-cell admin-user-twitch">
                {twitchBadges.length ? (
                  twitchBadges.map((badge) => (
                    <span key={badge.key} className={`admin-user-twitch-badge is-${badge.tone}`}>{badge.label}</span>
                  ))
                ) : "-"}
              </span>
              <span className="admin-user-cell admin-user-sync">{user.twitchRoleSyncedAt ? formatDate(user.twitchRoleSyncedAt) : "-"}</span>
              <span className={`admin-user-status ${user.isActive ? "is-active" : "is-inactive"}`}>
                {user.isActive ? "Activo" : "Inactivo"}
              </span>
              <div className="admin-user-actions">
                {canEditUser(user) ? (
                  <Tooltip label="Editar usuario">
                    <button
                      type="button"
                      className="icon-tool-button"
                      aria-label="Editar usuario"
                      onClick={() => setEditingUser(normalizeDraft(user))}
                    >
                      <Edit3 size={17} />
                    </button>
                  </Tooltip>
                ) : null}
                {canRunInternalOperations(user) ? (
                  <Tooltip label="Cambiar contraseña">
                    <button
                      type="button"
                      className="icon-tool-button"
                      aria-label="Cambiar contraseña"
                      onClick={() => setPasswordUser(normalizeDraft(user))}
                    >
                      <KeyRound size={17} />
                    </button>
                  </Tooltip>
                ) : null}
                {canRunInternalOperations(user) ? (
                  <Tooltip label={user.isActive ? "Desactivar usuario" : "Activar usuario"}>
                    <button
                      type="button"
                      className="icon-tool-button"
                      aria-label={user.isActive ? "Desactivar usuario" : "Activar usuario"}
                      onClick={() => setStatusUser(user)}
                      disabled={isSaving}
                    >
                      <Power size={17} />
                    </button>
                  </Tooltip>
                ) : null}
                {canRunInternalOperations(user) ? (
                  <Tooltip label="Eliminar usuario">
                    <button
                      type="button"
                      className="icon-tool-button danger"
                      aria-label="Eliminar usuario"
                      onClick={() => setPendingDelete(user)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </Tooltip>
                ) : null}
              </div>
            </div>
            );
          })}
      </MaintainerTable>

      {editingUser ? (
        <PlatformUserModal
          user={editingUser}
          editableRoles={editableRoles}
          isSaving={isSaving}
          onCancel={() => setEditingUser(null)}
          onSubmit={persistUser}
        />
      ) : null}

      {passwordUser ? (
        <PlatformPasswordModal
          user={passwordUser}
          isSaving={isSaving}
          onCancel={() => setPasswordUser(null)}
          onSubmit={persistUser}
        />
      ) : null}

      <ConfirmModal
        isOpen={Boolean(statusUser)}
        title={statusUser?.isActive ? "Desactivar usuario" : "Activar usuario"}
        description={statusUser?.isActive
          ? `${statusUser?.alias || "Este usuario"} no podrá iniciar sesión ni operar la plataforma.`
          : `${statusUser?.alias || "Este usuario"} podrá volver a iniciar sesión según sus permisos.`}
        confirmLabel={statusUser?.isActive ? "Desactivar" : "Activar"}
        cancelLabel="Cancelar"
        tone={statusUser?.isActive ? "danger" : "default"}
        isLoading={isSaving}
        onCancel={() => setStatusUser(null)}
        onConfirm={confirmStatusChange}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        title="Eliminar usuario"
        description={`Se archivará a ${pendingDelete?.alias || "este usuario"}, se cerrarán sus sesiones activas y dejará de aparecer en el mantenedor. Esta acción no se puede deshacer desde la pantalla.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteUser}
      />

      <AuditLogModal
        isOpen={isAuditOpen}
        module="admin.users"
        title="Historial de usuarios"
        subtitle="Últimas acciones realizadas en el mantenedor de usuarios."
        onClose={() => setIsAuditOpen(false)}
      />
    </>
  );
}
