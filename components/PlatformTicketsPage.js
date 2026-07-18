"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, History, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import AuditLogModal from "@/components/AuditLogModal";
import { FilterSelect } from "@/components/FiltersBar";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";
import Tooltip from "@/components/Tooltip";
import { formatPlatformDateTime } from "@/lib/dateTime";

const TYPE_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "suggestion", label: "Sugerencias" },
  { value: "claim", label: "Reclamos" },
  { value: "technical", label: "Problemas técnicos" },
  { value: "other", label: "Otros" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "open", label: "Abiertos" },
  { value: "in_review", label: "En revisión" },
  { value: "answered", label: "Respondidos" },
  { value: "resolved", label: "Resueltos" },
  { value: "closed", label: "Cerrados" },
];
const COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "subject", label: "Asunto", sortable: true },
  { key: "type", label: "Tipo", sortable: true },
  { key: "user", label: "Usuario" },
  { key: "lastMessageAt", label: "Última actividad", sortable: true },
  { key: "status", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];
const TYPE_LABELS = { suggestion: "Sugerencia", claim: "Reclamo", technical: "Problema técnico", other: "Otro" };
const STATUS_LABELS = { open: "Abierto", in_review: "En revisión", answered: "Respondido", resolved: "Resuelto", closed: "Cerrado" };

function getStatusClass(status) {
  if (status === "open") return "is-warning";
  if (status === "in_review") return "is-pending";
  if (status === "answered" || status === "resolved") return "is-active";
  return "is-inactive";
}

export default function PlatformTicketsPage({ initialResult = null, canUpdate = false }) {
  const [result, setResult] = useState(initialResult || { tickets: [], total: 0, page: 1, totalPages: 1, stats: {} });
  const [filters, setFilters] = useState({ search: "", status: "all", type: "all" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "lastMessageAt", direction: "desc" });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const params = new URLSearchParams({
        ...filters,
        page: String(page),
        pageSize: String(pageSize),
        sort: sortConfig.key,
        direction: sortConfig.direction,
      });
      const response = await fetch(`/api/admin/tickets?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudieron cargar los tickets.");
      setResult(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [filters, page, pageSize, sortConfig]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws`);
    socket.addEventListener("message", (event) => {
      try {
        if (JSON.parse(event.data)?.type === "tickets:update") void load({ showLoading: false });
      } catch {
        /* ignore malformed payloads */
      }
    });
    return () => socket.close();
  }, [load]);

  const pagination = useMemo(() => ({
    from: result.total ? (result.page - 1) * pageSize + 1 : 0,
    to: Math.min(result.page * pageSize, result.total),
    total: result.total || 0,
    pageSize,
    pageSizeOptions: [10, 25, 50, 100],
    onPageSizeChange: (value) => { setPageSize(value); setPage(1); },
    canPrevious: page > 1,
    canNext: page < result.totalPages,
    onPrevious: () => setPage((value) => value - 1),
    onNext: () => setPage((value) => value + 1),
  }), [page, pageSize, result.page, result.total, result.totalPages]);

  function toggleSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }

  return (
    <section className="support-ticket-page platform-ticket-page">
      <header className="watching-header admin-users-header support-ticket-header">
        <div className="header-badge"><MessageSquare size={16} /> ADMINISTRACIÓN</div>
        <h1 className="title">Mantenedor de <span className="text-gradient">tickets</span></h1>
        <p className="subtitle">Gestiona sugerencias y reclamos enviados por usuarios registrados.</p>
      </header>

      <MaintainerStats items={[
        { label: "Tickets", value: result.total || 0, color: "purple" },
        { label: "Abiertos", value: result.stats?.open || 0, color: "orange" },
        { label: "Respondidos", value: result.stats?.answered || 0, color: "green" },
      ]} />

      <section className="tracker-actions notification-page-actions">
        <div>
          <span className="tracker-actions-label">Tickets</span>
          <p className="tracker-actions-copy">Las respuestas se envían como notificación directa al usuario.</p>
        </div>
        <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
          <History size={17} />
          Historial
        </button>
      </section>

      <MaintainerToolbar searchId="admin-ticket-search" searchValue={filters.search} searchPlaceholder="Buscar por ID, asunto, usuario o mensaje..." onSearchChange={(value) => setFilters((current) => ({ ...current, search: value }))}>
        <FilterSelect id="admin-ticket-type" label="Tipo" value={filters.type} options={TYPE_OPTIONS} onChange={(value) => setFilters((current) => ({ ...current, type: value }))} />
        <FilterSelect id="admin-ticket-status" label="Estado" value={filters.status} options={STATUS_OPTIONS} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} />
      </MaintainerToolbar>

      <MaintainerTable
        ariaLabel="Tickets"
        columns={COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isLoading={isLoading}
        loadingText="Cargando tickets..."
        isEmpty={!result.tickets?.length}
        emptyText="No hay tickets con estos filtros."
        className="support-ticket-table platform-ticket-table"
        pagination={pagination}
      >
        {result.tickets?.map((ticket) => (
          <div className="maintainer-table-row support-ticket-row" role="row" key={ticket.id}>
            <span className="admin-user-cell">#{ticket.id}</span>
            <div className="admin-user-cell support-ticket-subject-cell">
              <strong>{ticket.subject}</strong>
            </div>
            <span className="admin-user-cell">{TYPE_LABELS[ticket.type] || ticket.type}</span>
            <div className="admin-user-cell admin-user-profile">
              <strong>{ticket.createdBy?.alias || ticket.createdBy?.login || "Usuario"}</strong>
            </div>
            <time className="admin-user-cell">{formatPlatformDateTime(ticket.lastMessageAt)}</time>
            <span className={`admin-user-status ${getStatusClass(ticket.status)}`}>{STATUS_LABELS[ticket.status] || ticket.status}</span>
            <div className="admin-user-actions">
              <Tooltip label={canUpdate ? "Abrir y responder" : "Abrir ticket"}>
                <a className="icon-tool-button support-ticket-open-action" href={`/administracion/tickets/${ticket.id}`} aria-label={`Abrir ticket #${ticket.id}`}>
                  <ExternalLink size={16} />
                </a>
              </Tooltip>
            </div>
          </div>
        ))}
      </MaintainerTable>

      <AuditLogModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        module="admin.tickets"
        title="Historial de tickets"
        closeOnBackdrop={false}
      />
    </section>
  );
}
