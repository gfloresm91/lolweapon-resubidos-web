"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit3, Plus, Power } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
const PAGE_SIZE = 10;
const ROLE_COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "role", label: "Rol", sortable: true },
  { key: "permissions", label: "Permisos", sortable: true },
  { key: "status", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];
const PROTECTED_ROLE_CODES = new Set(["dios", "invitado"]);
const ROLE_CODE_MAX_LENGTH = 40;
const ROLE_LABEL_MAX_LENGTH = 60;
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

function normalizeRole(role) {
  return {
    ...EMPTY_ROLE,
    ...role,
    permissions: role?.permissions || [],
  };
}

function getRolePermissionCount(role, permissions) {
  if (role.code === "dios") {
    return permissions.length;
  }

  return Array.isArray(role.permissions) ? role.permissions.length : 0;
}

function getRolePermissionGroups(role, permissions) {
  const rolePermissions = role.code === "dios"
    ? permissions.map((permission) => permission.code)
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

function formatRolePermissionSummary(role, permissions) {
  const permissionCount = getRolePermissionCount(role, permissions);
  const groupCount = getRolePermissionGroups(role, permissions).length;

  if (!permissionCount) {
    return "Sin permisos";
  }

  const permissionLabel = permissionCount === 1 ? "1 permiso" : `${permissionCount} permisos`;
  const groupLabel = groupCount === 1 ? "1 área" : `${groupCount} áreas`;
  return `${permissionLabel} en ${groupLabel}`;
}

function getRoleSortValue(role, key, permissions) {
  if (key === "id") {
    return role.id || 0;
  }

  if (key === "permissions") {
    return getRolePermissionCount(role, permissions);
  }

  if (key === "status") {
    return role.isActive ? 1 : 0;
  }

  return String(role.label || role.code || "").toLowerCase();
}

function isSensitivePermission(permission) {
  return permission.code.startsWith("users.")
    || permission.code.startsWith("roles.")
    || permission.code.endsWith(".delete")
    || permission.code.endsWith(".form.full");
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
  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);
  const filteredGroupedPermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();

    if (!query) {
      return groupedPermissions;
    }

    return Object.entries(groupedPermissions).reduce((groups, [group, groupPermissions]) => {
      const filteredPermissions = groupPermissions.filter((permission) => [
        permission.code,
        permission.label,
        permission.group,
      ].some((value) => String(value || "").toLowerCase().includes(query)));

      if (filteredPermissions.length) {
        groups[group] = filteredPermissions;
      }

      return groups;
    }, {});
  }, [groupedPermissions, permissionSearch]);
  const isGod = normalizedRole.code === "dios";
  const isGuest = normalizedRole.code === "invitado";
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
      setDraftPermissions(permissions.map((permission) => permission.code));
    }
  }, [isGod, permissions]);

  function updatePermissions(nextPermissions) {
    if (isGod) {
      return;
    }

    setDraftPermissions(Array.from(new Set(nextPermissions)));
  }

  function togglePermission(code) {
    if (isGod) {
      return;
    }

    const nextPermissions = draftPermissions.includes(code)
      ? draftPermissions.filter((permission) => permission !== code)
      : [...draftPermissions, code];

    updatePermissions(nextPermissions);
  }

  function selectGroup(groupPermissions) {
    updatePermissions([...draftPermissions, ...groupPermissions.map((permission) => permission.code)]);
  }

  function clearGroup(groupPermissions) {
    const groupCodes = new Set(groupPermissions.map((permission) => permission.code));
    updatePermissions(draftPermissions.filter((permission) => !groupCodes.has(permission)));
  }

  async function submitRole(values) {
    try {
      await onSubmit({
        ...normalizedRole,
        code: values.code.trim().toLowerCase(),
        label: values.label.trim(),
        permissions: isGod ? permissions.map((permission) => permission.code) : draftPermissions,
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
          <div className="permissions-grid">
            {Object.entries(filteredGroupedPermissions).map(([group, groupPermissions]) => (
              <fieldset className="permission-group" key={group}>
                <legend>
                  <span>{group}</span>
                  {!isGod ? (
                    <em>{groupPermissions.filter((permission) => draftPermissions.includes(permission.code)).length}/{groupPermissions.length}</em>
                  ) : null}
                </legend>
                {!isGod ? (
                  <div className="permission-group-actions">
                    <button type="button" onClick={() => selectGroup(groupPermissions)}>Todo</button>
                    <button type="button" onClick={() => clearGroup(groupPermissions)}>Limpiar</button>
                  </div>
                ) : null}
                {groupPermissions.map((permission) => (
                  <label key={permission.code} className={`permission-check ${isSensitivePermission(permission) ? "is-sensitive" : ""}`}>
                    <input
                      type="checkbox"
                      checked={isGod || draftPermissions.includes(permission.code)}
                      disabled={isGod}
                      onChange={() => togglePermission(permission.code)}
                    />
                    <span>{permission.label}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          {Object.keys(filteredGroupedPermissions).length ? null : (
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
  const [editingRole, setEditingRole] = useState(null);
  const [statusRole, setStatusRole] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialRoles.length);
  const filteredRoles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return roles
      .filter((role) => !query || [role.id, role.code, role.label].some((value) => String(value || "").toLowerCase().includes(query)))
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
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / PAGE_SIZE));
  const paginatedRoles = filteredRoles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginationFrom = filteredRoles.length ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0;
  const paginationTo = Math.min(currentPage * PAGE_SIZE, filteredRoles.length);
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
        <button type="button" className="tracker-action-primary" onClick={() => setEditingRole(EMPTY_ROLE)}>
          <Plus size={18} />
          Nuevo rol
        </button>
      </section>

      <MaintainerToolbar
        searchId="admin-roles-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, nombre o código"
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
          onPrevious: () => setCurrentPage((page) => Math.max(1, page - 1)),
          onNext: () => setCurrentPage((page) => Math.min(totalPages, page + 1)),
        }}
      >
        {paginatedRoles.map((role) => {
          const permissionCount = getRolePermissionCount(role, permissions);

          return (
            <div className="maintainer-table-row admin-roles-row" role="row" key={role.id || role.code}>
              <span className="admin-user-cell admin-record-id">#{role.id || "-"}</span>
              <div className="admin-user-cell">
                <strong>{role.label}</strong>
                <span className="admin-role-code">{role.code}</span>
              </div>
              <div className="admin-user-cell admin-role-permissions-summary">
                <strong>{permissionCount === 1 ? "1 permiso" : `${permissionCount} permisos`}</strong>
                <small>{formatRolePermissionSummary(role, permissions)}</small>
              </div>
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
    </>
  );
}
