"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Edit3, History, Plus, Power, Radio, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";
import TagPanel from "@/components/TagPanel";
import TrackerMaintainerModal from "@/components/TrackerMaintainerModal";
import { DEFAULT_LIVE_STATUS_LABEL, LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const MONTH_LABELS = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};
const TRACKER_COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "live", label: "Directo", sortable: true },
  { key: "date", label: "Fecha", sortable: true },
  { key: "status", label: "Estado", sortable: true },
  { key: "tags", label: "Tags", sortable: true },
  { key: "availability", label: "Disponibilidad", sortable: true },
  { key: "actions", label: "Acciones" },
];

function buildId() {
  return `new_${Date.now()}`;
}

function getLiveRecordId(live) {
  return live?.dbId || "-";
}

function formatLiveRecordId(live) {
  const id = getLiveRecordId(live);
  return id === "-" ? "-" : `#${id}`;
}

function parseLiveDate(value) {
  const [day = "01", month = "01", year = "1900"] = String(value || "").split("/");
  return `${year}-${month}-${day}`;
}

function getLiveMonth(live) {
  const [, month = ""] = String(live?.date || "").split("/");
  return month.padStart(2, "0");
}

function formatMonthLabel(month) {
  return MONTH_LABELS[month] || month;
}

function getLiveTitle(live) {
  return live?.title || live?.id || "Sin título";
}

function getLiveLinksCount(live) {
  return Object.values(live?.links || {}).reduce((total, links) => total + (Array.isArray(links) ? links.length : 0), 0);
}

function getStatusClassName(status) {
  const value = String(status || "").toLowerCase();

  if (!value) {
    return "is-warning";
  }

  if (value.includes("lost") || value.includes("incompleto")) {
    return "is-danger";
  }

  if (value.includes("pendiente") || value.includes("subiendo")) {
    return "is-warning";
  }

  return "is-active";
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "No se pudo subir la imagen.");
  }

  return data.path;
}

export default function PlatformTrackerMaintainerPage({
  initialLives = [],
  initialStatuses = LIVE_STATUS_OPTIONS,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  canUpdateTags = false,
  twitchLogin = "",
  onLivesChange,
  onStatusesChange,
}) {
  const [lives, setLives] = useState(initialLives);
  const [statuses, setStatuses] = useState(initialStatuses.length ? initialStatuses : LIVE_STATUS_OPTIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [sorting, setSorting] = useState([{ id: "date", desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [editingLive, setEditingLive] = useState(null);
  const [statusLive, setStatusLive] = useState(null);
  const [nextStatus, setNextStatus] = useState("");
  const [deleteLive, setDeleteLive] = useState(null);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isEventSubConfirmOpen, setIsEventSubConfirmOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialLives.length);
  const [isTwitchActionLoading, setIsTwitchActionLoading] = useState(false);

  const yearOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    ...Array.from(new Set(lives.map((live) => String(live.year || "").trim()).filter(Boolean)))
      .sort((left, right) => right.localeCompare(left, "es", { numeric: true }))
      .map((year) => ({ value: year, label: year })),
  ], [lives]);
  const monthOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    ...Array.from(new Set(
      lives
        .filter((live) => yearFilter === "all" || String(live.year) === yearFilter)
        .map(getLiveMonth)
        .filter(Boolean),
    ))
      .sort((left, right) => Number(left) - Number(right))
      .map((month) => ({ value: month, label: formatMonthLabel(month) })),
  ], [lives, yearFilter]);

  const statusOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    ...Array.from(new Set([
      ...statuses.map((status) => status.label || status),
      ...lives.map((live) => live.status).filter(Boolean),
    ]))
      .sort((left, right) => String(left).localeCompare(String(right), "es"))
      .map((status) => ({ value: status, label: status })),
  ], [lives, statuses]);
  const availabilityOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    { value: "with", label: "Con enlaces" },
    { value: "without", label: "Sin enlaces" },
    { value: "telegram", label: "Telegram" },
    { value: "okru", label: "OK.RU" },
    { value: "patreon", label: "Patreon" },
    { value: "piero", label: "Piero" },
  ], []);
  const tagCounts = useMemo(() => lives.reduce((counts, live) => {
    for (const tag of live.tags || []) {
      counts[tag] = (counts[tag] || 0) + 1;
    }

    return counts;
  }, {}), [lives]);
  const availableTags = useMemo(
    () => Object.keys(tagCounts).sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" })),
    [tagCounts],
  );
  const filteredLives = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return lives
      .filter((live) => !query || [
        getLiveRecordId(live),
        live.id,
        live.title,
        live.year,
        live.date,
        live.status,
        live.additional_info,
        ...(live.tags || []),
        ...Object.entries(live.links || {})
          .filter(([, links]) => Array.isArray(links) && links.length)
          .map(([platform]) => platform),
      ].some((value) => String(value || "").toLowerCase().includes(query)))
      .filter((live) => yearFilter === "all" || String(live.year) === yearFilter)
      .filter((live) => monthFilter === "all" || getLiveMonth(live) === monthFilter)
      .filter((live) => statusFilter === "all" || live.status === statusFilter)
      .filter((live) => tagFilter === "all" || (live.tags || []).includes(tagFilter))
      .filter((live) => {
        if (availabilityFilter === "with") return getLiveLinksCount(live) > 0;
        if (availabilityFilter === "without") return getLiveLinksCount(live) === 0;
        if (availabilityFilter !== "all") return Boolean(live.links?.[availabilityFilter]?.length);
        return true;
      });
  }, [availabilityFilter, lives, monthFilter, searchQuery, statusFilter, tagFilter, yearFilter]);
  const tableColumns = useMemo(() => [
    { id: "id", accessorFn: (live) => getLiveRecordId(live) },
    { id: "live", accessorFn: (live) => getLiveTitle(live) },
    { id: "date", accessorFn: (live) => parseLiveDate(live.date) },
    { id: "status", accessorFn: (live) => live.status || "" },
    { id: "tags", accessorFn: (live) => (live.tags || []).join(" ") },
    { id: "availability", accessorFn: (live) => getLiveLinksCount(live) },
  ], []);
  const table = useReactTable({
    data: filteredLives,
    columns: tableColumns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const paginatedLives = table.getRowModel().rows.map((row) => row.original);
  const paginationFrom = filteredLives.length ? (pagination.pageIndex * pagination.pageSize) + 1 : 0;
  const paginationTo = Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredLives.length);
  const sortConfig = sorting[0]
    ? { key: sorting[0].id, direction: sorting[0].desc ? "desc" : "asc" }
    : null;
  const stats = useMemo(() => ({
    total: lives.length,
    withLinks: lives.filter((live) => getLiveLinksCount(live) > 0).length,
    withoutLinks: lives.filter((live) => getLiveLinksCount(live) === 0).length,
  }), [lives]);

  useEffect(() => {
    setLives(initialLives);
  }, [initialLives]);

  useEffect(() => {
    setStatuses(initialStatuses.length ? initialStatuses : LIVE_STATUS_OPTIONS);
  }, [initialStatuses]);

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [availabilityFilter, monthFilter, searchQuery, yearFilter, statusFilter, tagFilter]);

  useEffect(() => {
    if (monthFilter === "all" || monthOptions.some((option) => option.value === monthFilter)) {
      return;
    }

    setMonthFilter("all");
  }, [monthFilter, monthOptions]);

  useEffect(() => {
    if (tagFilter === "all" || availableTags.includes(tagFilter)) {
      return;
    }

    setTagFilter("all");
  }, [availableTags, tagFilter]);

  useEffect(() => {
    if (initialLives.length) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;

    async function loadLives() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/lives", { cache: "no-store" });
        const data = await response.json();

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok || !data.lives) {
          throw new Error(data.error || "No se pudo cargar el rastreador.");
        }

        if (isMounted) {
          setLives(data.lives || []);
          setStatuses(data.statuses || LIVE_STATUS_OPTIONS);
          onLivesChange?.(data.lives || []);
          onStatusesChange?.(data.statuses || LIVE_STATUS_OPTIONS);
        }
      } catch (error) {
        toast.error(error.message || "No se pudo cargar el rastreador.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLives();

    return () => {
      isMounted = false;
    };
  }, [initialLives.length, onLivesChange, onStatusesChange]);

  function toggleSort(key) {
    setSorting((current) => {
      const active = current[0];

      if (active?.id === key) {
        return [{ id: key, desc: !active.desc }];
      }

      return [{ id: key, desc: false }];
    });
  }

  function updateLives(nextLives, nextStatuses) {
    setLives(nextLives);
    onLivesChange?.(nextLives);

    if (nextStatuses) {
      setStatuses(nextStatuses);
      onStatusesChange?.(nextStatuses);
    }
  }

  async function saveLive(nextLive) {
    if (nextLive?.id && !canUpdate) {
      toast.error("No tienes permiso para editar directos.");
      return false;
    }

    if (!nextLive?.id && !canCreate) {
      toast.error("No tienes permiso para crear directos.");
      return false;
    }

    setIsSaving(true);

    try {
      let imagePath = nextLive.image || "";

      if (nextLive.imageFile) {
        imagePath = await uploadImage(nextLive.imageFile);
      }

      const payload = {
        ...(nextLive || {}),
        image: imagePath,
        id: nextLive.id || buildId(),
      };

      delete payload.imageFile;

      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextLive.id ? "upsert" : "create", live: payload }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el directo.");
      }

      updateLives(data.lives || [], data.statuses || statuses);
      setEditingLive(null);
      toast.success(nextLive.id ? "Directo actualizado." : "Directo creado.");
      return true;
    } catch (error) {
      toast.error(error.message || "No se pudo guardar el directo.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteLive || !canDelete) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: deleteLive.id }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el directo.");
      }

      updateLives(data.lives || [], data.statuses || statuses);
      setDeleteLive(null);
      toast.success("Directo eliminado.");
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el directo.");
    } finally {
      setIsSaving(false);
    }
  }

  function openStatusChange(live) {
    setStatusLive(live);
    setNextStatus(live.status || DEFAULT_LIVE_STATUS_LABEL);
  }

  async function saveLiveStatus() {
    if (!statusLive || !canUpdate) {
      return false;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          id: statusLive.id,
          status: nextStatus,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return false;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar el estado.");
      }

      updateLives(data.lives || [], data.statuses || statuses);
      toast.success("Estado actualizado.");
      return true;
    } catch (error) {
      toast.error(error.message || "No se pudo cambiar el estado.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!statusLive || !canUpdate) {
      return;
    }

    const wasSaved = await saveLiveStatus();
    if (wasSaved) {
      setStatusLive(null);
    }
  }

  async function archiveCurrentTwitchLive() {
    if (!canCreate) {
      toast.error("No tienes permiso para crear directos.");
      return;
    }

    setIsTwitchActionLoading(true);

    try {
      const response = await fetch("/api/twitch/archive", { method: "POST" });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo crear el card desde Twitch.");
      }

      const refreshResponse = await fetch("/api/lives", { cache: "no-store" });
      const refreshData = await refreshResponse.json();
      updateLives(refreshData.lives || [], refreshData.statuses || LIVE_STATUS_OPTIONS);
      setIsArchiveConfirmOpen(false);
      toast.success("Card de Twitch creado o actualizado.");
    } catch (error) {
      toast.error(error.message || "No se pudo crear el card desde Twitch.");
    } finally {
      setIsTwitchActionLoading(false);
    }
  }

  async function registerTwitchEventSub() {
    if (!canUpdate) {
      toast.error("No tienes permiso para configurar EventSub.");
      return;
    }

    setIsTwitchActionLoading(true);

    try {
      const response = await fetch("/api/twitch/eventsub/subscribe", { method: "POST" });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo registrar EventSub.");
      }

      toast.success("EventSub registrado. Twitch notificará el próximo directo.");
      setIsEventSubConfirmOpen(false);
    } catch (error) {
      toast.error(error.message || "No se pudo registrar EventSub.");
    } finally {
      setIsTwitchActionLoading(false);
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
          Mantenedor <span className="text-gradient">Rastreador</span>
        </h1>
        <p className="subtitle">Administra los directos, enlaces, estados y tags del archivo VODs.</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Directos", value: stats.total, color: "purple" },
          { label: "Con enlaces", value: stats.withLinks, color: "blue" },
          { label: "Sin enlaces", value: stats.withoutLinks, color: "green" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones del rastreador">
        <div>
          <span className="tracker-actions-label">Rastreador</span>
          <p className="tracker-actions-copy">Gestiona los registros del archivo histórico.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
          {canCreate ? (
            <button type="button" className="tracker-action-primary" onClick={() => setEditingLive({})}>
              <Plus size={18} />
              Nuevo directo
            </button>
          ) : null}
          {canCreate ? (
            <button type="button" className="tracker-action-secondary" onClick={() => setIsArchiveConfirmOpen(true)} disabled={isTwitchActionLoading}>
              <Radio size={17} />
              Crear desde Twitch
            </button>
          ) : null}
          {canUpdate ? (
            <button type="button" className="tracker-action-secondary" onClick={() => setIsEventSubConfirmOpen(true)} disabled={isTwitchActionLoading}>
              <Zap size={17} />
              Registrar EventSub
            </button>
          ) : null}
        </div>
      </section>

      <MaintainerToolbar
        searchId="admin-tracker-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, título, tag, año, fecha o estado"
        onSearchChange={setSearchQuery}
      >
        <FilterSelect
          id="admin-tracker-year-filter"
          label="Año"
          value={yearFilter}
          options={yearOptions}
          onChange={(year) => {
            setYearFilter(year);
            setMonthFilter("all");
          }}
        />
        <FilterSelect
          id="admin-tracker-month-filter"
          label="Mes"
          value={monthFilter}
          options={monthOptions}
          onChange={setMonthFilter}
          disabled={yearFilter === "all"}
          disabledHint="Selecciona un año para filtrar por mes"
        />
        <FilterSelect
          id="admin-tracker-status-filter"
          label="Estado"
          value={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter}
        />
        <FilterSelect
          id="admin-tracker-availability-filter"
          label="Disponibilidad"
          value={availabilityFilter}
          options={availabilityOptions}
          onChange={setAvailabilityFilter}
        />
        <button
          type="button"
          className={`btn-tag-panel ${tagFilter !== "all" ? "is-active" : ""}`}
          onClick={() => setIsTagPanelOpen(true)}
        >
          <span className="btn-tag-panel-icon" aria-hidden="true">#</span>
          <span className="btn-tag-panel-label">
            {tagFilter !== "all" ? `Tag: ${tagFilter}` : "Tags"}
          </span>
        </button>
      </MaintainerToolbar>

      {tagFilter !== "all" ? (
        <button type="button" className="selected-tag-banner maintainer-selected-tag" onClick={() => setTagFilter("all")}>
          Filtrando por tag: <strong>{tagFilter}</strong>
          <span aria-hidden="true">×</span>
        </button>
      ) : null}

      <MaintainerTable
        ariaLabel="Mantenedor Rastreador"
        className="admin-tracker-table"
        columns={TRACKER_COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isLoading={isLoading}
        loadingText="Cargando directos..."
        isEmpty={!filteredLives.length}
        emptyText="No hay directos que coincidan con la búsqueda."
        pagination={{
          from: paginationFrom,
          to: paginationTo,
          total: filteredLives.length,
          canPrevious: table.getCanPreviousPage(),
          canNext: table.getCanNextPage(),
          pageSize: pagination.pageSize,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageSizeChange: (pageSize) => table.setPageSize(pageSize),
          onPrevious: () => table.previousPage(),
          onNext: () => table.nextPage(),
        }}
      >
        {paginatedLives.map((live) => (
          <div className="maintainer-table-row admin-tracker-row" role="row" key={live.id}>
            <span className="admin-user-cell admin-record-id">{formatLiveRecordId(live)}</span>
            <div className="admin-user-cell admin-tracker-title">
              <strong>{getLiveTitle(live)}</strong>
              <span>{live.id ? `Código: ${live.id}` : "Sin código"}</span>
            </div>
            <div className="admin-user-cell admin-anime-summary">
              <strong>{live.date || "Sin fecha"}</strong>
              <small>{live.year || "Sin año"}</small>
            </div>
            <span className={`admin-user-status ${getStatusClassName(live.status)}`}>{live.status || "Sin estado"}</span>
            <div className="admin-user-cell admin-tracker-tags">
              {(live.tags || []).slice(0, 2).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
              {(live.tags || []).length > 2 ? <small>+{live.tags.length - 2}</small> : null}
              {!live.tags?.length ? <small>Sin tags</small> : null}
            </div>
            <div className="admin-user-cell admin-anime-summary">
              <strong>{getLiveLinksCount(live)} enlaces</strong>
              <div className="admin-tracker-platforms">
                {Object.entries(live.links || {}).filter(([, links]) => Array.isArray(links) && links.length).map(([platform, links]) => (
                  <span key={platform}>{platform} {links.length}</span>
                ))}
                {!getLiveLinksCount(live) ? <span className="is-empty">Sin enlaces</span> : null}
              </div>
            </div>
            <div className="admin-user-actions">
              {canUpdate ? (
                <button
                  type="button"
                  className="icon-tool-button"
                  aria-label="Editar directo"
                  onClick={() => setEditingLive(live)}
                >
                  <Edit3 size={17} />
                </button>
              ) : null}
              {canUpdate ? (
                <button
                  type="button"
                  className="icon-tool-button"
                  aria-label="Cambiar estado"
                  onClick={() => openStatusChange(live)}
                  disabled={isSaving}
                >
                  <Power size={17} />
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="icon-tool-button danger"
                  aria-label="Eliminar directo"
                  onClick={() => setDeleteLive(live)}
                  disabled={isSaving}
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </MaintainerTable>

      <TrackerMaintainerModal
        live={editingLive && editingLive.id ? editingLive : null}
        isOpen={Boolean(editingLive)}
        onClose={() => setEditingLive(null)}
        onSave={saveLive}
        isSaving={isSaving}
        statuses={statuses}
        availableTags={availableTags}
        tagCounts={tagCounts}
      />

      <TagPanel
        isOpen={isTagPanelOpen}
        tags={availableTags}
        tagCounts={tagCounts}
        selectedTag={tagFilter === "all" ? "" : tagFilter}
        onClose={() => setIsTagPanelOpen(false)}
        onSelectTag={(tag) => {
          setTagFilter(tag || "all");
          setIsTagPanelOpen(false);
        }}
        isAdmin={canUpdateTags}
      />

      {statusLive ? (
        <MaintainerModal
          className="admin-modal tracker-status-modal"
          title="Cambiar estado"
          subtitle={getLiveTitle(statusLive)}
          onClose={() => setStatusLive(null)}
          actions={(
            <>
              <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setStatusLive(null)} disabled={isSaving}>
                Cancelar
              </button>
              <button type="button" className="btn-modal btn-modal-primary" onClick={confirmStatusChange} disabled={isSaving || !nextStatus}>
                {isSaving ? "Guardando..." : "Guardar estado"}
              </button>
            </>
          )}
        >
          <div className="form-group-modal">
            <label>Estado</label>
            <FormSelect
              id="tracker-status-change"
              label="Estado"
              value={nextStatus}
              options={statusOptions.filter((option) => option.value !== "all")}
              onChange={setNextStatus}
            />
          </div>
          <p className="admin-modal-help">Esta operación actualiza solo el estado del directo.</p>
        </MaintainerModal>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(deleteLive)}
        title="Eliminar directo"
        description={`${getLiveTitle(deleteLive)} será eliminado del rastreador. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setDeleteLive(null)}
        onConfirm={confirmDelete}
      />

      <ConfirmModal
        isOpen={isArchiveConfirmOpen}
        title="Crear desde Twitch"
        description="Se creará o actualizará el directo actual usando la información disponible desde Twitch."
        confirmLabel="Crear desde Twitch"
        cancelLabel="Cancelar"
        tone="default"
        isLoading={isTwitchActionLoading}
        onCancel={() => setIsArchiveConfirmOpen(false)}
        onConfirm={archiveCurrentTwitchLive}
      />

      <ConfirmModal
        isOpen={isEventSubConfirmOpen}
        title="Registrar EventSub"
        description={`Se registrará la suscripción para que Twitch notifique el próximo directo${twitchLogin ? ` del canal ${twitchLogin}` : " del canal configurado"}.`}
        confirmLabel="Registrar"
        cancelLabel="Cancelar"
        tone="default"
        isLoading={isTwitchActionLoading}
        onCancel={() => setIsEventSubConfirmOpen(false)}
        onConfirm={registerTwitchEventSub}
      />

      <AuditLogModal
        isOpen={isAuditOpen}
        module="admin.tracker"
        title="Historial del rastreador"
        subtitle="Últimas acciones realizadas en el mantenedor del rastreador."
        onClose={() => setIsAuditOpen(false)}
      />
    </>
  );
}
