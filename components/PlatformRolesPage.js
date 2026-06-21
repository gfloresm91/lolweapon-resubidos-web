"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit3, Eye, FilePenLine, History, LayoutPanelTop, Plus, Power, ShieldAlert, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";

const EMPTY_ROLE = {
  code: "",
  label: "",
  isActive: true,
  permissions: [],
};
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const ROLE_COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "role", label: "Rol", sortable: true },
  { key: "code", label: "Código", sortable: true },
  { key: "permissions", label: "Permisos", sortable: true },
  { key: "areas", label: "Áreas", sortable: true },
  { key: "status", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];
const PROTECTED_ROLE_CODES = new Set(["dios", "invitado"]);
const RATING_WRITE_PERMISSION_CODE = "anime.rating.write";
const STREAMER_RATING_PERMISSION_CODE = "anime.rating.streamer";
const GOD_EXCLUDED_PERMISSION_CODES = new Set([STREAMER_RATING_PERMISSION_CODE]);
const ROLE_CODE_MAX_LENGTH = 40;
const ROLE_LABEL_MAX_LENGTH = 60;
const PERMISSION_GROUP_ORDER = [
  "Plataforma: Inicio",
  "Plataforma: Novedades",
  "Plataforma: Historial de cambios",
  "Archivo VOD: Rastreador",
  "Archivo VOD: Calendario",
  "Biblioteca de anime: Viendo",
  "Biblioteca de anime: Terminados",
  "Biblioteca de anime: Puntuación",
  "Lecturas: SpaceDrum",
  "Administración: Usuarios",
  "Administración: Roles",
  "Administración: Rastreador",
  "Administración: Tags",
  "Administración: Anime Viendo",
  "Administración: Anime Terminados",
  "Administración: SpaceDrum",
];
const PERMISSION_GROUP_ORDER_MAP = new Map(PERMISSION_GROUP_ORDER.map((group, index) => [group, index]));
const ROLE_CODE_RULES = z
  .string()
  .trim()
  .min(1, "El código del rol es obligatorio.")
  .min(3, "El código del rol debe tener al menos 3 caracteres.")
  .max(ROLE_CODE_MAX_LENGTH, "El código del rol no puede superar 40 caracteres.")
  .regex(/^[a-z0-9._-]+$/, "Usa solo minúsculas, números, punto, guion o guion bajo.");
const ROLE_LABEL_RULES = z
  .string()
  .trim()
  .min(1, "El nombre del rol es obligatorio.")
  .min(2, "El nombre del rol debe tener al menos 2 caracteres.")
  .max(ROLE_LABEL_MAX_LENGTH, "El nombre del rol no puede superar 60 caracteres.");
const roleSchema = z.object({
  code: ROLE_CODE_RULES,
  label: ROLE_LABEL_RULES,
});

function groupPermissions(permissions) {
  return permissions.reduce((groups, permission) => {
    const group = permission.group || "General";
    groups[group] = groups[group] || [];
    groups[group].push(permission);
    return groups;
  }, {});
}

function getPermissionGroupOrder(group) {
  return PERMISSION_GROUP_ORDER_MAP.has(group) ? PERMISSION_GROUP_ORDER_MAP.get(group) : 999;
}

function normalizeRole(role) {
  return {
    ...EMPTY_ROLE,
    ...role,
    permissions: role?.permissions || [],
  };
}

function getRolePermissionCount(role, permissions) {
  if (role.code === "dios") {
    return permissions.filter((permission) => !GOD_EXCLUDED_PERMISSION_CODES.has(permission.code)).length;
  }

  return Array.isArray(role.permissions) ? role.permissions.length : 0;
}

function getRolePermissionGroups(role, permissions) {
  const rolePermissions = role.code === "dios"
    ? permissions
      .map((permission) => permission.code)
      .filter((permissionCode) => !GOD_EXCLUDED_PERMISSION_CODES.has(permissionCode))
    : role.permissions || [];

  return permissions
    .filter((permission) => rolePermissions.includes(permission.code))
    .reduce((groups, permission) => {
      if (!groups.includes(permission.group || "General")) {
        groups.push(permission.group || "General");
      }

      return groups;
    }, []);
}

function getRolePermissionGroupCount(role, permissions) {
  return getRolePermissionGroups(role, permissions).length;
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getRoleSearchValues(role, permissions) {
  const permissionCount = getRolePermissionCount(role, permissions);
  const areaCount = getRolePermissionGroupCount(role, permissions);
  const statusLabel = role.isActive ? "activo" : "inactivo";

  return [
    role.id,
    role.label,
    role.code,
    permissionCount,
    `${permissionCount} ${permissionCount === 1 ? "permiso" : "permisos"}`,
    areaCount,
    `${areaCount} ${areaCount === 1 ? "area" : "areas"}`,
    statusLabel,
  ];
}

function getRoleSortValue(role, key, permissions) {
  if (key === "id") {
    return role.id || 0;
  }

  if (key === "permissions") {
    return getRolePermissionCount(role, permissions);
  }

  if (key === "areas") {
    return getRolePermissionGroupCount(role, permissions);
  }

  if (key === "status") {
    return role.isActive ? 1 : 0;
  }

  if (key === "code") {
    return String(role.code || "").toLowerCase();
  }

  return String(role.label || role.code || "").toLowerCase();
}

function isSensitivePermission(permission) {
  return permission.code.startsWith("users.")
    || permission.code.startsWith("roles.")
    || permission.code.endsWith(".delete")
    || permission.code.endsWith(".form.full");
}

function getPermissionAction(permission) {
  const code = permission.code || "";

  if (code.endsWith(".view") || code.endsWith(".read")) {
    return { label: "Ver pantalla", icon: Eye };
  }

  if (code.endsWith(".create")) {
    return { label: "Crear", icon: Plus };
  }

  if (code.endsWith(".update")) {
    return { label: "Editar", icon: FilePenLine };
  }

  if (code.endsWith(".delete")) {
    return { label: "Eliminar", icon: Trash2 };
  }

  if (code.endsWith(".form.full")) {
    return { label: "Formulario completo", icon: LayoutPanelTop };
  }

  if (code.endsWith(".form.compact")) {
    return { label: "Formulario compacto", icon: LayoutPanelTop };
  }

  if (code === "anime.rating.write") {
    return { label: "Calificar anime", icon: Sparkles };
  }

  if (code === "anime.rating.streamer") {
    return { label: "Mostrar nota destacada", icon: Sparkles };
  }

  return { label: permission.label || code, icon: ShieldCheck };
}

function getPermissionDescription(permission) {
  if (permission.description) {
    return permission.description;
  }

  const code = permission.code || "";
  const group = permission.group || "General";

  if (code.endsWith(".form.full")) {
    return "Permite usar el formulario completo en esta pantalla.";
  }

  if (code.endsWith(".form.compact")) {
    return "Permite usar el formulario compacto en esta pantalla.";
  }

  if (code.endsWith(".delete")) {
    return "Operación sensible: puede borrar o desactivar registros.";
  }

  if (code === STREAMER_RATING_PERMISSION_CODE) {
    return "Permite que las puntuaciones de este rol se muestren como nota destacada en las cards. Solo un rol puede tenerlo.";
  }

  return `${group} · ${code}`;
}

function getRoleErrorField(message) {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("código")) {
    return "code";
  }

  if (normalized.includes("nombre")) {
    return "label";
  }

  return null;
}

function RoleModal({ role, permissions, isSaving, onCancel, onSubmit }) {
  const normalizedRole = normalizeRole(role);
  const rolePermissionsKey = normalizedRole.permissions.join("|");
  const [draftPermissions, setDraftPermissions] = useState(normalizedRole.permissions);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [activePermissionGroup, setActivePermissionGroup] = useState("");
  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);
  const permissionGroups = useMemo(() => (
    Object.entries(groupedPermissions)
      .map(([group, groupPermissions]) => ({
        group,
        permissions: groupPermissions,
        groupOrder: getPermissionGroupOrder(group),
        sortOrder: Math.min(...groupPermissions.map((permission) => permission.sortOrder || 0)),
      }))
      .sort((left, right) => (left.groupOrder - right.groupOrder) || (left.sortOrder - right.sortOrder) || left.group.localeCompare(right.group, "es"))
  ), [groupedPermissions]);
  const selectedGroup = activePermissionGroup || permissionGroups[0]?.group || "";
  const visiblePermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();

    if (query) {
      return permissions.filter((permission) => [
        permission.code,
        permission.label,
        permission.group,
      ].some((value) => String(value || "").toLowerCase().includes(query)));
    }

    return groupedPermissions[selectedGroup] || [];
  }, [groupedPermissions, permissionSearch, permissions, selectedGroup]);
  const selectedGroupPermissions = groupedPermissions[selectedGroup] || [];
  const isGod = normalizedRole.code === "dios";
  const isGuest = normalizedRole.code === "invitado";
  const isPermissionChecked = (permission) => isGod
    ? !GOD_EXCLUDED_PERMISSION_CODES.has(permission.code)
    : draftPermissions.includes(permission.code);
  const selectedGroupCount = selectedGroupPermissions.filter(isPermissionChecked).length;
  const selectedSensitiveCount = permissions.filter((permission) => draftPermissions.includes(permission.code) && isSensitivePermission(permission)).length;
  const selectedModuleCount = getRolePermissionGroups({ ...normalizedRole, permissions: draftPermissions }, permissions).length;
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm({
    resolver: zodResolver(roleSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      code: normalizedRole.code,
      label: normalizedRole.label,
    },
  });

  useEffect(() => {
    reset({
      code: normalizedRole.code,
      label: normalizedRole.label,
    });
    setDraftPermissions(normalizedRole.permissions);
  }, [normalizedRole.code, normalizedRole.id, normalizedRole.label, reset, rolePermissionsKey]);

  useEffect(() => {
    if (isGod) {
      setDraftPermissions(permissions
        .map((permission) => permission.code)
        .filter((permissionCode) => !GOD_EXCLUDED_PERMISSION_CODES.has(permissionCode)));
    }
  }, [isGod, permissions]);

  useEffect(() => {
    if (!permissionGroups.length) {
      return;
    }

    if (!activePermissionGroup || !permissionGroups.some((item) => item.group === activePermissionGroup)) {
      setActivePermissionGroup(permissionGroups[0].group);
    }
  }, [activePermissionGroup, permissionGroups]);

  function updatePermissions(nextPermissions) {
    if (isGod) {
      return;
    }

    const normalizedPermissions = Array.from(new Set(nextPermissions));
    if (normalizedPermissions.includes(STREAMER_RATING_PERMISSION_CODE) && !normalizedPermissions.includes(RATING_WRITE_PERMISSION_CODE)) {
      normalizedPermissions.push(RATING_WRITE_PERMISSION_CODE);
    }

    setDraftPermissions(normalizedPermissions);
  }

  function togglePermission(code) {
    if (isGod) {
      return;
    }

    let nextPermissions = draftPermissions.includes(code)
      ? draftPermissions.filter((permission) => permission !== code)
      : [...draftPermissions, code];

    if (code === RATING_WRITE_PERMISSION_CODE && draftPermissions.includes(STREAMER_RATING_PERMISSION_CODE)) {
      nextPermissions = nextPermissions.filter((permission) => permission !== STREAMER_RATING_PERMISSION_CODE);
    }

    updatePermissions(nextPermissions);
  }

  function selectGroup(groupPermissions) {
    updatePermissions([...draftPermissions, ...groupPermissions.map((permission) => permission.code)]);
  }

  function clearGroup(groupPermissions) {
    const groupCodes = new Set(groupPermissions.map((permission) => permission.code));
    updatePermissions(draftPermissions.filter((permission) => !groupCodes.has(permission)));
  }

  function selectReadOnly(groupPermissions) {
    const groupCodes = new Set(groupPermissions.map((permission) => permission.code));
    const readOnlyCodes = groupPermissions
      .filter((permission) => permission.code.endsWith(".view") || permission.code.endsWith(".read"))
      .map((permission) => permission.code);

    updatePermissions([
      ...draftPermissions.filter((permission) => !groupCodes.has(permission)),
      ...readOnlyCodes,
    ]);
  }

  async function submitRole(values) {
    try {
      const nextPermissions = isGod
        ? permissions
          .map((permission) => permission.code)
          .filter((permissionCode) => !GOD_EXCLUDED_PERMISSION_CODES.has(permissionCode))
        : draftPermissions;

      await onSubmit({
        ...normalizedRole,
        code: values.code.trim().toLowerCase(),
        label: values.label.trim(),
        permissions: nextPermissions,
      });
    } catch (error) {
      const errorField = getRoleErrorField(error.message);
      if (errorField) {
        setError(errorField, { type: "server", message: error.message });
        return;
      }

      toast.error(error.message || "No se pudo guardar el rol.");
    }
  }

  return (
    <MaintainerModal
      as="form"
      className="admin-modal role-modal"
      title={normalizedRole.id ? "Editar rol" : "Nuevo rol"}
      onClose={onCancel}
      onSubmit={handleSubmit(submitRole)}
      noValidate
      actions={(
        <>
          <button type="button" className="btn-modal btn-modal-secondary" onClick={onCancel}>Cancelar</button>
          {isGod ? null : (
            <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          )}
        </>
      )}
    >
        {isGod ? <p className="admin-modal-notice">El rol Dios es inmutable y siempre tiene todos los permisos.</p> : null}
        {isGuest ? <p className="admin-modal-notice">El rol Invitado representa a quienes no han iniciado sesión y siempre debe permanecer activo.</p> : null}
        <div className="admin-modal-section">
          <h3>Identidad</h3>
          <div className="form-row">
            <div className="form-group-modal">
              <label htmlFor="platform-role-code">Código</label>
              <input
                id="platform-role-code"
                className="modal-input"
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? "platform-role-code-error" : undefined}
                maxLength={ROLE_CODE_MAX_LENGTH}
                readOnly={Boolean(normalizedRole.id)}
                {...register("code", {
                  setValueAs: (value) => String(value || "").trim().toLowerCase(),
                })}
              />
              {errors.code ? <span id="platform-role-code-error" className="field-error">{errors.code.message}</span> : null}
            </div>
            <div className="form-group-modal">
              <label htmlFor="platform-role-label">Nombre</label>
              <input
                id="platform-role-label"
                className="modal-input"
                aria-invalid={Boolean(errors.label)}
                aria-describedby={errors.label ? "platform-role-label-error" : undefined}
                maxLength={ROLE_LABEL_MAX_LENGTH}
                readOnly={isGod}
                {...register("label")}
              />
              {errors.label ? <span id="platform-role-label-error" className="field-error">{errors.label.message}</span> : null}
            </div>
          </div>
          <div className="role-permission-summary-cards" aria-label="Resumen del rol">
            <div>
              <span>Permisos activos</span>
              <strong>{isGod ? permissions.filter((permission) => !GOD_EXCLUDED_PERMISSION_CODES.has(permission.code)).length : draftPermissions.length}</strong>
            </div>
            <div>
              <span>Módulos con acceso</span>
              <strong>{isGod ? permissionGroups.length : selectedModuleCount}</strong>
            </div>
            <div className={selectedSensitiveCount ? "is-sensitive" : ""}>
              <span>Permisos críticos</span>
              <strong>{isGod ? permissions.filter((permission) => isSensitivePermission(permission) && !GOD_EXCLUDED_PERMISSION_CODES.has(permission.code)).length : selectedSensitiveCount}</strong>
            </div>
          </div>
        </div>

        <div className="admin-modal-section">
          <div className="permission-section-heading">
            <h3>Permisos</h3>
            {!isGod ? <span>{draftPermissions.length}/{permissions.length}</span> : <span>Todos</span>}
          </div>
          {!isGod && draftPermissions.length === 0 ? (
            <p className="admin-modal-warning">Este rol no tiene permisos seleccionados. Quedará sin acceso operativo hasta que le asignes al menos uno.</p>
          ) : null}
          <div className="form-group-modal permission-search-field">
            <label htmlFor="platform-role-permission-search">Buscar permisos</label>
            <input
              id="platform-role-permission-search"
              className="modal-input"
              type="search"
              value={permissionSearch}
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder="Buscar por nombre, código o área"
            />
          </div>
          <div className="role-permission-layout">
            <nav className="role-permission-tabs" aria-label="Módulos de permisos">
              {permissionGroups.map(({ group, permissions: groupPermissions }) => {
                const selectedCount = groupPermissions.filter(isPermissionChecked).length;
                const isActive = !permissionSearch.trim() && selectedGroup === group;

                return (
                  <button
                    type="button"
                    key={group}
                    className={isActive ? "is-active" : ""}
                    onClick={() => {
                      setPermissionSearch("");
                      setActivePermissionGroup(group);
                    }}
                  >
                    <span>{group}</span>
                    <em>{isGod ? groupPermissions.length : selectedCount}/{groupPermissions.length}</em>
                  </button>
                );
              })}
            </nav>
            <section className="role-permission-panel">
              <div className="role-permission-panel-heading">
                <div>
                  <span>{permissionSearch.trim() ? "Resultados" : selectedGroup}</span>
                  <strong>{permissionSearch.trim() ? `${visiblePermissions.length} coincidencias` : `${selectedGroupCount}/${selectedGroupPermissions.length} permisos activos`}</strong>
                </div>
                {!isGod && !permissionSearch.trim() ? (
                  <div className="permission-group-actions">
                    <button type="button" onClick={() => selectGroup(selectedGroupPermissions)}>Seleccionar todo</button>
                    <button type="button" onClick={() => selectReadOnly(selectedGroupPermissions)}>Solo lectura</button>
                    <button type="button" onClick={() => clearGroup(selectedGroupPermissions)}>Limpiar</button>
                  </div>
                ) : null}
              </div>
              <div className="role-permission-list">
                {visiblePermissions.map((permission) => {
                  const action = getPermissionAction(permission);
                  const Icon = action.icon;
                  const checked = isPermissionChecked(permission);

                  return (
                    <label key={permission.code} className={`permission-row ${checked ? "is-checked" : ""} ${isSensitivePermission(permission) ? "is-sensitive" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isGod}
                        onChange={() => togglePermission(permission.code)}
                      />
                      <span className="permission-row-icon"><Icon size={16} /></span>
                      <span className="permission-row-copy">
                        <strong>{action.label}</strong>
                        <small>{getPermissionDescription(permission)}</small>
                      </span>
                      {isSensitivePermission(permission) ? <em>Crítico</em> : null}
                      <span className="permission-row-toggle" aria-hidden="true" />
                    </label>
                  );
                })}
              </div>
            </section>
          </div>
          {visiblePermissions.length ? null : (
            <p className="admin-modal-empty">No hay permisos que coincidan con la búsqueda.</p>
          )}
        </div>
    </MaintainerModal>
  );
}

export default function PlatformRolesPage({ initialRoles = [], initialPermissions = [] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [editingRole, setEditingRole] = useState(null);
  const [statusRole, setStatusRole] = useState(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialRoles.length);
  const filteredRoles = useMemo(() => {
    const query = normalizeSearchValue(searchQuery.trim());
    return roles
      .filter((role) => !query || getRoleSearchValues(role, permissions).some((value) => normalizeSearchValue(value).includes(query)))
      .filter((role) => {
        if (statusFilter === "active") return role.isActive;
        if (statusFilter === "inactive") return !role.isActive;
        return true;
      })
      .sort((left, right) => {
        const leftValue = getRoleSortValue(left, sortConfig.key, permissions);
        const rightValue = getRoleSortValue(right, sortConfig.key, permissions);
        const direction = sortConfig.direction === "asc" ? 1 : -1;

        if (typeof leftValue === "number" && typeof rightValue === "number") {
          return (leftValue - rightValue) * direction;
        }

        return String(leftValue).localeCompare(String(rightValue), "es", { numeric: true }) * direction;
      });
  }, [permissions, roles, searchQuery, sortConfig.direction, sortConfig.key, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
  const paginatedRoles = filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginationFrom = filteredRoles.length ? ((currentPage - 1) * pageSize) + 1 : 0;
  const paginationTo = Math.min(currentPage * pageSize, filteredRoles.length);
  const stats = useMemo(() => ({
    total: roles.length,
    active: roles.filter((role) => role.isActive).length,
    permissions: permissions.length,
  }), [permissions.length, roles]);

  function toggleSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (initialRoles.length) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;

    async function loadRoles() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/platform-roles", { cache: "no-store" });
        const data = await response.json();

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || "No se pudieron cargar los roles.");
        }

        if (isMounted) {
          setRoles(data.roles || []);
          setPermissions(data.permissions || []);
        }
      } catch (error) {
        toast.error(error.message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRoles();

    return () => {
      isMounted = false;
    };
  }, [initialRoles.length]);

  async function persistRole(role) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/platform-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: role.id ? "update" : "create", role }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el rol.");
      }

      setRoles(data.roles || []);
      setPermissions(data.permissions || []);
      setEditingRole(null);
      setStatusRole(null);
      toast.success("Rol guardado.");
    } catch (error) {
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!statusRole) {
      return;
    }

    const nextStatus = !statusRole.isActive;
    setIsSaving(true);

    try {
      const response = await fetch("/api/platform-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-status",
          id: statusRole.id,
          isActive: nextStatus,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar el estado del rol.");
      }

      setRoles(data.roles || []);
      setPermissions(data.permissions || []);
      setStatusRole(null);
      toast.success(nextStatus ? "Rol activado." : "Rol desactivado.");
    } catch (error) {
      toast.error(error.message || "No se pudo cambiar el estado del rol.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="watching-header admin-users-header">
        <div className="header-badge">
          <span className="dot" />
          ADMINISTRACIÓN
        </div>
        <h1 className="title">
          Roles de <span className="text-gradient">la plataforma</span>
        </h1>
        <p className="subtitle">Define qué puede ver y operar cada rol dentro del sistema.</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Roles", value: stats.total, color: "purple" },
          { label: "Activos", value: stats.active, color: "green" },
          { label: "Permisos", value: stats.permissions, color: "purple" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones de roles">
        <div>
          <span className="tracker-actions-label">Administración</span>
          <p className="tracker-actions-copy">Crea roles y asigna permisos por área del sistema.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
          <button type="button" className="tracker-action-primary" onClick={() => setEditingRole(EMPTY_ROLE)}>
            <Plus size={18} />
            Nuevo rol
          </button>
        </div>
      </section>

      <MaintainerToolbar
        searchId="admin-roles-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, rol, código, permisos, áreas o estado"
        onSearchChange={setSearchQuery}
      >
        <FilterSelect
          id="admin-roles-status-filter"
          label="Estado"
          value={statusFilter}
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Activos" },
            { value: "inactive", label: "Inactivos" },
          ]}
          onChange={setStatusFilter}
        />
      </MaintainerToolbar>

      <MaintainerTable
        ariaLabel="Roles de la plataforma"
        className="admin-roles-table"
        columns={ROLE_COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isLoading={isLoading}
        loadingText="Cargando roles..."
        isEmpty={!filteredRoles.length}
        emptyText="No hay roles que coincidan con la búsqueda."
        pagination={{
          from: paginationFrom,
          to: paginationTo,
          total: filteredRoles.length,
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
        {paginatedRoles.map((role) => {
          const permissionCount = getRolePermissionCount(role, permissions);
          const areaCount = getRolePermissionGroupCount(role, permissions);

          return (
            <div className="maintainer-table-row admin-roles-row" role="row" key={role.id || role.code}>
              <span className="admin-user-cell admin-record-id">#{role.id || "-"}</span>
              <div className="admin-user-cell">
                <strong>{role.label}</strong>
              </div>
              <span className="admin-user-cell admin-role-code-cell">{role.code}</span>
              <div className="admin-user-cell admin-role-permissions-summary">
                <strong>{permissionCount === 1 ? "1 permiso" : `${permissionCount} permisos`}</strong>
              </div>
              <span className="admin-user-cell admin-role-areas-cell">{areaCount === 1 ? "1 área" : `${areaCount} áreas`}</span>
              <span className={`admin-user-status ${role.isActive ? "is-active" : "is-inactive"}`}>
                {role.isActive ? "Activo" : "Inactivo"}
              </span>
              <div className="admin-user-actions">
                <button
                  type="button"
                  className="icon-tool-button"
                  aria-label="Editar rol"
                  onClick={() => setEditingRole(normalizeRole(role))}
                >
                  <Edit3 size={17} />
                </button>
                {!PROTECTED_ROLE_CODES.has(role.code) ? (
                  <button
                    type="button"
                    className="icon-tool-button"
                    aria-label={role.isActive ? "Desactivar rol" : "Activar rol"}
                    onClick={() => setStatusRole(role)}
                    disabled={isSaving}
                  >
                    <Power size={17} />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </MaintainerTable>

      {editingRole ? (
        <RoleModal
          role={editingRole}
          permissions={permissions}
          isSaving={isSaving}
          onCancel={() => setEditingRole(null)}
          onSubmit={persistRole}
        />
      ) : null}

      <ConfirmModal
        isOpen={Boolean(statusRole)}
        title={statusRole?.isActive ? "Desactivar rol" : "Activar rol"}
        description={statusRole?.isActive
          ? `El rol ${statusRole?.label || "seleccionado"} dejará de entregar permisos a los usuarios que lo tengan asignado.`
          : `El rol ${statusRole?.label || "seleccionado"} volverá a entregar sus permisos configurados.`}
        confirmLabel={statusRole?.isActive ? "Desactivar" : "Activar"}
        cancelLabel="Cancelar"
        tone={statusRole?.isActive ? "danger" : "default"}
        isLoading={isSaving}
        onCancel={() => setStatusRole(null)}
        onConfirm={confirmStatusChange}
      />

      <AuditLogModal
        isOpen={isAuditOpen}
        module="admin.roles"
        title="Historial de roles"
        subtitle="Últimas acciones realizadas en el mantenedor de roles."
        onClose={() => setIsAuditOpen(false)}
      />
    </>
  );
}
