"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  BookOpen,
  CheckCheck,
  CirclePlay,
  Edit3,
  History,
  Plus,
  Power,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Tv,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import DatePickerInput from "@/components/DatePickerInput";
import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";
import Tooltip from "@/components/Tooltip";
import { formatPlatformDateTime } from "@/lib/dateTime";

const TYPES = [
  { value: "alert", label: "Alerta" },
  { value: "activity", label: "Actividad" },
  { value: "system", label: "Sistema" },
];
const SEVERITIES = [
  { value: "info", label: "Información" },
  { value: "success", label: "Éxito" },
  { value: "warning", label: "Advertencia" },
  { value: "danger", label: "Crítica" },
];
const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "system", label: "Sistema" },
  { value: "twitch", label: "Twitch" },
  { value: "youtube", label: "YouTube" },
  { value: "tracker", label: "Rastreador" },
  { value: "anime", label: "Anime" },
  { value: "spacedrum", label: "SpaceDrum" },
  { value: "content", label: "Contenido" },
];
const AUDIENCES = [
  { value: "all", label: "Todos" },
  { value: "authenticated", label: "Autenticados" },
  { value: "admin", label: "Administración" },
  { value: "permission", label: "Permiso específico" },
  { value: "user", label: "Usuario específico" },
];
const ICON_COMPONENTS = {
  Bell,
  BellRing,
  BookOpen,
  CheckCheck,
  CirclePlay,
  Radio,
  ShieldAlert,
  Sparkles,
  Tv,
  Video,
};
const ICON_OPTIONS = [
  { value: "", label: "Automático por tipo" },
  { value: "Bell", label: "Campana" },
  { value: "BellRing", label: "Campana activa" },
  { value: "ShieldAlert", label: "Alerta" },
  { value: "Sparkles", label: "Sistema / novedad" },
  { value: "CirclePlay", label: "Video" },
  { value: "Tv", label: "Directo / TV" },
  { value: "Video", label: "Video cámara" },
  { value: "BookOpen", label: "Lectura / capítulo" },
  { value: "Radio", label: "Transmisión" },
  { value: "CheckCheck", label: "Confirmación" },
];
const EMPTY_FORM = {
  type: "activity",
  severity: "info",
  source: "manual",
  title: "",
  body: "",
  href: "",
  icon: "",
  audienceType: "authenticated",
  audienceTarget: "",
  publishMode: "now",
  scheduledAt: "",
  expiresAt: "",
  isActive: true,
};
const EMPTY_TARGET_OPTIONS = { permissions: [], users: [] };
const COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "title", label: "Título", sortable: true },
  { key: "severity", label: "Severidad", sortable: true },
  { key: "type", label: "Tipo", sortable: true },
  { key: "source", label: "Origen", sortable: true },
  { key: "audience", label: "Audiencia", sortable: true },
  { key: "published", label: "Publicación", sortable: true },
  { key: "status", label: "Estado" },
  { key: "actions", label: "Acciones" },
];
const TYPE_LABELS = Object.fromEntries(TYPES.map((item) => [item.value, item.label]));
const SEVERITY_LABELS = Object.fromEntries(SEVERITIES.map((item) => [item.value, item.label]));
const SOURCE_LABELS = Object.fromEntries(SOURCES.map((item) => [item.value, item.label]));
const AUDIENCE_LABELS = Object.fromEntries(AUDIENCES.map((item) => [item.value, item.label]));

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getStatus(item) {
  const now = new Date();
  if (item.deletedAt) return "Eliminada";
  if (!item.isActive) return "Inactiva";
  if (!item.publishedAt && item.scheduledAt) return "Programada";
  if (item.expiresAt && new Date(item.expiresAt) <= now) return "Expirada";
  return "Publicada";
}

function getStatusClass(item) {
  if (item.deletedAt) return "is-danger";
  if (!item.isActive) return "is-inactive";
  if (!item.publishedAt && item.scheduledAt) return "is-pending";
  if (item.expiresAt && new Date(item.expiresAt) <= new Date()) return "is-warning";
  return "is-active";
}

function formatAudience(audience) {
  if (!audience) return "-";
  const [type, ...target] = audience.split(":");
  const label = AUDIENCE_LABELS[type] || audience;
  return target.length ? `${label}: ${target.join(":")}` : label;
}

function getFallbackIcon(type) {
  if (type === "alert") return ShieldAlert;
  if (type === "system") return Sparkles;
  return Bell;
}

function LabeledSelect({ id, label, value, options, onChange }) {
  return (
    <div className="notification-form-field">
      <label htmlFor={id}>{label}</label>
      <FormSelect id={id} label={label} value={value} options={options} onChange={onChange} />
    </div>
  );
}

function IconPreview({ icon, type, severity }) {
  const Icon = ICON_COMPONENTS[icon] || getFallbackIcon(type);

  return (
    <div className="notification-icon-preview">
      <span className={`notification-page-card-icon is-${severity}`} aria-hidden="true">
        <Icon size={19} />
      </span>
      <div>
        <strong>{icon ? icon : "Automático"}</strong>
        <span>{icon ? "Icono personalizado permitido." : "Se calculará según el tipo de notificación."}</span>
      </div>
    </div>
  );
}

export default function PlatformNotificationsPage({ initialResult = null, canCreate, canUpdate, canDelete }) {
  const [result, setResult] = useState(initialResult || { notifications: [], total: 0, page: 1, totalPages: 1, stats: {} });
  const [targetOptions, setTargetOptions] = useState(initialResult?.targetOptions || EMPTY_TARGET_OPTIONS);
  const [filters, setFilters] = useState({ search: "", type: "all", severity: "all", source: "all", status: "all" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        ...filters,
        page: String(page),
        pageSize: String(pageSize),
        sort: sortConfig.key,
        direction: sortConfig.direction,
      });
      const response = await fetch(`/api/admin/notifications?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudieron cargar las notificaciones.");
      setResult(data);
      setTargetOptions(data.targetOptions || EMPTY_TARGET_OPTIONS);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, pageSize, sortConfig]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);
  const form = editing?.form || EMPTY_FORM;
  useEffect(() => {
    if (!editing || !["permission", "user"].includes(form.audienceType)) return;

    const options = form.audienceType === "permission" ? targetOptions.permissions : targetOptions.users;
    if (!options.length) return;
    if (options.some((option) => option.value === form.audienceTarget)) return;

    field("audienceTarget", options[0].value);
  }, [editing, form.audienceTarget, form.audienceType, targetOptions.permissions, targetOptions.users]);

  const statusOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    { value: "published", label: "Publicadas" },
    { value: "scheduled", label: "Programadas" },
    { value: "inactive", label: "Inactivas" },
    { value: "expired", label: "Expiradas" },
    { value: "deleted", label: "Eliminadas" },
  ], []);

  function toggleSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }

  function openEditor(item = null) {
    const audience = item?.audience || "authenticated";
    const [audienceType, ...target] = audience.split(":");
    setEditing({
      id: item?.id || null,
      form: item
        ? {
            ...EMPTY_FORM,
            ...item,
            icon: ICON_COMPONENTS[item.icon] ? item.icon : "",
            audienceType,
            audienceTarget: target.join(":"),
            publishMode: item.scheduledAt && !item.publishedAt ? "scheduled" : "now",
            scheduledAt: toLocalInput(item.scheduledAt),
            expiresAt: toLocalInput(item.expiresAt),
          }
        : { ...EMPTY_FORM },
    });
  }

  function field(key, value) {
    setEditing((current) => ({ ...current, form: { ...current.form, [key]: value } }));
  }

  function updateAudienceType(value) {
    const options = value === "permission"
      ? targetOptions.permissions
      : value === "user"
        ? targetOptions.users
        : [];

    setEditing((current) => ({
      ...current,
      form: {
        ...current.form,
        audienceType: value,
        audienceTarget: options[0]?.value || "",
      },
    }));
  }

  async function request(action, payload = {}) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo completar la operación.");
      const successMessages = {
        create: "Notificación creada.",
        update: "Notificación actualizada.",
        activate: "Notificación activada.",
        deactivate: "Notificación desactivada.",
        delete: "Notificación eliminada.",
        restore: "Notificación restaurada.",
      };
      toast.success(successMessages[action] || "Operación completada.");
      setEditing(null);
      setPendingAction(null);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  function save(event) {
    event.preventDefault();
    if (["permission", "user"].includes(form.audienceType) && !form.audienceTarget.trim()) {
      toast.error(form.audienceType === "permission" ? "Selecciona un permiso objetivo." : "Selecciona un usuario objetivo.");
      return;
    }

    const audience = ["permission", "user"].includes(form.audienceType)
      ? `${form.audienceType}:${form.audienceTarget.trim()}`
      : form.audienceType;
    void request(editing.id ? "update" : "create", {
      id: editing.id,
      notification: {
        ...form,
        id: editing.id,
        audience,
        scheduledAt: form.publishMode === "scheduled" ? form.scheduledAt : null,
        expiresAt: form.expiresAt || null,
      },
    });
  }

  return (
    <section className="platform-notifications-page">
      <header className="watching-header admin-users-header">
        <div className="header-badge"><Bell size={16} /> ADMINISTRACIÓN</div>
        <h1 className="title">Mantenedor de <span className="text-gradient">notificaciones</span></h1>
        <p className="subtitle">Publica, programa y administra avisos manuales y automáticos.</p>
      </header>

      <MaintainerStats items={[
        { label: "Total", value: result.stats?.total || 0, color: "purple" },
        { label: "Publicadas", value: result.stats?.published || 0, color: "green" },
        { label: "Programadas", value: result.stats?.scheduled || 0, color: "blue" },
        { label: "Inactivas", value: result.stats?.inactive || 0, color: "orange" },
      ]} />

      <section className="tracker-actions">
        <div>
          <span className="tracker-actions-label">Gestión</span>
          <p className="tracker-actions-copy">Las eliminaciones son lógicas para conservar deduplicación y trazabilidad.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} /> Historial
          </button>
          {canCreate ? (
            <button type="button" className="tracker-action-primary" onClick={() => openEditor()}>
              <Plus size={17} /> Nueva notificación
            </button>
          ) : null}
        </div>
      </section>

      <MaintainerToolbar
        searchId="admin-notification-search"
        searchValue={filters.search}
        searchPlaceholder="Buscar por ID, título, contenido o audiencia..."
        onSearchChange={(value) => setFilters((current) => ({ ...current, search: value }))}
      >
        <FilterSelect id="admin-notification-type" label="Tipo" value={filters.type} options={[{ value: "all", label: "Todos los tipos" }, ...TYPES]} onChange={(value) => setFilters((current) => ({ ...current, type: value }))} />
        <FilterSelect id="admin-notification-severity" label="Severidad" value={filters.severity} options={[{ value: "all", label: "Todas las severidades" }, ...SEVERITIES]} onChange={(value) => setFilters((current) => ({ ...current, severity: value }))} />
        <FilterSelect id="admin-notification-source" label="Origen" value={filters.source} options={[{ value: "all", label: "Todos los orígenes" }, ...SOURCES]} onChange={(value) => setFilters((current) => ({ ...current, source: value }))} />
        <FilterSelect id="admin-notification-status" label="Estado" value={filters.status} options={statusOptions} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} />
      </MaintainerToolbar>

      <MaintainerTable
        ariaLabel="Notificaciones"
        columns={COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isLoading={isLoading}
        loadingText="Cargando notificaciones..."
        isEmpty={!result.notifications?.length}
        emptyText="No hay notificaciones que coincidan con los filtros."
        className="notification-maintainer-table"
        pagination={{
          from: result.total ? (result.page - 1) * pageSize + 1 : 0,
          to: Math.min(result.page * pageSize, result.total),
          total: result.total,
          pageSize,
          pageSizeOptions: [10, 25, 50, 100],
          onPageSizeChange: (value) => { setPageSize(value); setPage(1); },
          canPrevious: page > 1,
          canNext: page < result.totalPages,
          onPrevious: () => setPage((value) => value - 1),
          onNext: () => setPage((value) => value + 1),
        }}
      >
        {result.notifications?.map((item) => (
          <div className="maintainer-table-row admin-notification-row" role="row" key={item.id}>
            <span className="admin-user-cell admin-record-id">#{item.id}</span>
            <span className="admin-user-cell maintainer-primary-cell">
              <strong>{item.title}</strong>
            </span>
            <span className="admin-user-cell">{SEVERITY_LABELS[item.severity] || item.severity}</span>
            <span className="admin-user-cell">{TYPE_LABELS[item.type] || item.type}</span>
            <span className="admin-user-cell">{SOURCE_LABELS[item.source] || item.source}</span>
            <span className="admin-user-cell admin-notification-audience">{formatAudience(item.audience)}</span>
            <span className="admin-user-cell">{formatPlatformDateTime(item.scheduledAt || item.publishedAt || item.createdAt)}</span>
            <span><span className={`admin-user-status ${getStatusClass(item)}`}>{getStatus(item)}</span></span>
            <span className="admin-user-actions admin-notification-actions">
              {canUpdate && !item.deletedAt ? (
                <>
                  <Tooltip label="Editar">
                    <button type="button" className="icon-tool-button" aria-label={`Editar ${item.title}`} onClick={() => openEditor(item)}>
                      <Edit3 size={16} />
                    </button>
                  </Tooltip>
                  <Tooltip label={item.isActive ? "Desactivar" : "Activar"}>
                    <button type="button" className="icon-tool-button" aria-label={item.isActive ? "Desactivar" : "Activar"} onClick={() => setPendingAction({ item, action: item.isActive ? "deactivate" : "activate" })}>
                      <Power size={16} />
                    </button>
                  </Tooltip>
                </>
              ) : null}
              {canDelete ? (
                <Tooltip label={item.deletedAt ? "Restaurar" : "Eliminar"}>
                  <button type="button" className="icon-tool-button danger" aria-label={item.deletedAt ? "Restaurar" : "Eliminar"} onClick={() => setPendingAction({ item, action: item.deletedAt ? "restore" : "delete" })}>
                    {item.deletedAt ? <RotateCcw size={16} /> : <Trash2 size={16} />}
                  </button>
                </Tooltip>
              ) : null}
            </span>
          </div>
        ))}
      </MaintainerTable>

      {editing ? (
        <MaintainerModal
          as="form"
          title={editing.id ? "Editar notificación" : "Nueva notificación"}
          subtitle="Define contenido, audiencia y momento de publicación."
          className="admin-modal notification-editor-modal"
          closeOnBackdrop={false}
          onClose={() => setEditing(null)}
          onSubmit={save}
          noValidate
          actions={(
            <>
              <button type="button" className="modal-button secondary" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="modal-button primary" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</button>
            </>
          )}
        >
          <div className="form-row notification-publication-row">
            <LabeledSelect id="notification-form-type" label="Tipo" value={form.type} options={TYPES} onChange={(value) => field("type", value)} />
            <LabeledSelect id="notification-form-severity" label="Severidad" value={form.severity} options={SEVERITIES} onChange={(value) => field("severity", value)} />
          </div>
          <div className="form-row">
            <LabeledSelect id="notification-form-source" label="Origen" value={form.source} options={SOURCES} onChange={(value) => field("source", value)} />
            <LabeledSelect id="notification-form-audience" label="Audiencia" value={form.audienceType} options={AUDIENCES} onChange={updateAudienceType} />
          </div>
          {["permission", "user"].includes(form.audienceType) ? (
            <div className="notification-form-field">
              <label htmlFor="notification-form-audience-target">
                {form.audienceType === "permission" ? "Permiso objetivo" : "Usuario objetivo"}
              </label>
              <FormSelect
                id="notification-form-audience-target"
                label={form.audienceType === "permission" ? "Permiso objetivo" : "Usuario objetivo"}
                value={form.audienceTarget}
                options={form.audienceType === "permission" ? targetOptions.permissions : targetOptions.users}
                onChange={(value) => field("audienceTarget", value)}
                disabled={form.audienceType === "permission" ? !targetOptions.permissions.length : !targetOptions.users.length}
              />
              <span className="field-help">
                {form.audienceType === "permission"
                  ? "Solo los usuarios con ese permiso verán la notificación."
                  : "Solo el usuario seleccionado verá la notificación."}
              </span>
            </div>
          ) : null}
          <label className="form-group-modal">
            <span>Título</span>
            <input className="modal-input" value={form.title} maxLength={160} onChange={(event) => field("title", event.target.value)} />
          </label>
          <label className="form-group-modal">
            <span>Contenido</span>
            <textarea className="modal-input notification-editor-textarea" value={form.body || ""} maxLength={500} onChange={(event) => field("body", event.target.value)} />
          </label>
          <div className="form-row">
            <label className="form-group-modal">
              <span>Enlace</span>
              <input className="modal-input" placeholder="/rastreador/..., /spacedrum o https://..." value={form.href || ""} onChange={(event) => field("href", event.target.value)} />
              <span className="field-help">Opcional. Se abrirá desde el centro de notificaciones.</span>
            </label>
            <div className="notification-form-field">
              <label htmlFor="notification-form-icon">Icono</label>
              <FormSelect id="notification-form-icon" label="Icono" value={form.icon || ""} options={ICON_OPTIONS} onChange={(value) => field("icon", value)} />
              <IconPreview icon={form.icon} type={form.type} severity={form.severity} />
            </div>
          </div>
          <div className="form-row">
            <LabeledSelect
              id="notification-publish-mode"
              label="Publicación"
              value={form.publishMode}
              options={[{ value: "now", label: "Inmediata" }, { value: "scheduled", label: "Programada" }]}
              onChange={(value) => field("publishMode", value)}
            />
            {form.publishMode === "scheduled" ? (
              <div className="notification-form-field notification-scheduled-date-field">
                <label htmlFor="notification-scheduled-at">Fecha de publicación</label>
                <DatePickerInput
                  id="notification-scheduled-at"
                  value={form.scheduledAt}
                  onChange={(value) => field("scheduledAt", value)}
                  className="modal-input notification-date-input"
                  placeholder="Seleccionar fecha y hora"
                  enableTime
                />
              </div>
            ) : null}
          </div>
          <label className="form-group-modal">
            <span>Fecha de expiración (opcional)</span>
            <DatePickerInput
              value={form.expiresAt}
              onChange={(value) => field("expiresAt", value)}
              className="modal-input notification-date-input"
              placeholder="Seleccionar fecha y hora"
              enableTime
            />
            <span className="field-help">Al expirar deja de mostrarse a usuarios finales.</span>
          </label>
        </MaintainerModal>
      ) : null}

      {pendingAction ? (
        <ConfirmModal
          isOpen
          title={`${pendingAction.action === "delete" ? "Eliminar" : pendingAction.action === "restore" ? "Restaurar" : pendingAction.action === "activate" ? "Activar" : "Desactivar"} notificación`}
          description={`Se aplicará el cambio a “${pendingAction.item.title}”.`}
          confirmLabel={pendingAction.action === "delete" ? "Eliminar" : pendingAction.action === "restore" ? "Restaurar" : pendingAction.action === "activate" ? "Activar" : "Desactivar"}
          tone={pendingAction.action === "delete" ? "danger" : "primary"}
          onConfirm={() => request(pendingAction.action, { id: pendingAction.item.id })}
          onCancel={() => setPendingAction(null)}
          isLoading={isSaving}
        />
      ) : null}
      <AuditLogModal
        isOpen={isAuditOpen}
        module="admin.notifications"
        title="Historial de notificaciones"
        closeOnBackdrop={false}
        onClose={() => setIsAuditOpen(false)}
      />
    </section>
  );
}
