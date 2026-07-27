"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
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
const FORM_TYPE_OPTIONS = [
  { value: "suggestion", label: "Sugerencia" },
  { value: "claim", label: "Reclamo" },
  { value: "technical", label: "Problema técnico" },
  { value: "other", label: "Otro" },
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
  { key: "subject", label: "Asunto" },
  { key: "type", label: "Tipo" },
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

export default function SupportTicketsPage({ initialResult = null, canCreate = false, onNavigateToTicket = null }) {
  const [result, setResult] = useState(initialResult || { tickets: [], total: 0, page: 1, totalPages: 1, stats: {} });
  const [filters, setFilters] = useState({ search: "", status: "all", type: "all" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "lastMessageAt", direction: "desc" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({ type: "suggestion", subject: "", body: "" });
  const [formErrors, setFormErrors] = useState({});

  const load = useCallback(async ({ showLoading = true, nextPage = page } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const params = new URLSearchParams({
        ...filters,
        page: String(nextPage),
        pageSize: String(pageSize),
        sort: sortConfig.key,
        direction: sortConfig.direction,
      });
      const response = await fetch(`/api/support-tickets?${params}`, { cache: "no-store" });
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

  function closeCreateModal() {
    if (isSaving) return;
    setIsCreateOpen(false);
    setForm({ type: "suggestion", subject: "", body: "" });
    setFormErrors({});
  }

  async function submitTicket(event) {
    event.preventDefault();
    const nextErrors = {
      subject: !form.subject.trim() ? "El asunto es obligatorio." : "",
      body: !form.body.trim() ? "El mensaje es obligatorio." : "",
    };
    setFormErrors(nextErrors);
    if (nextErrors.subject || nextErrors.body) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo crear el ticket.");
      toast.success("Ticket enviado. Administración recibirá una notificación.");
      setForm({ type: "suggestion", subject: "", body: "" });
      setFormErrors({});
      setIsCreateOpen(false);
      setPage(1);
      await load({ showLoading: false, nextPage: 1 });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="support-ticket-page">
      <header className="watching-header admin-users-header support-ticket-header">
        <h1 className="title">Sugerencias/<span className="text-gradient">Reclamos</span></h1>
        <p className="subtitle">Envía una solicitud y revisa las respuestas de administración desde una conversación simple.</p>
      </header>

      <MaintainerStats items={[
        { label: "Tickets", value: result.total || 0, color: "purple" },
        { label: "Abiertos", value: result.stats?.open || 0, color: "orange" },
        { label: "Respondidos", value: result.stats?.answered || 0, color: "green" },
      ]} />

      <section className="tracker-actions notification-page-actions support-ticket-actions">
        <div>
          <span className="tracker-actions-label">Bandeja de soporte</span>
          <p className="tracker-actions-copy">Crea tickets y revisa las respuestas de administración desde tu campana o el historial.</p>
        </div>
        {canCreate ? (
          <button type="button" className="tracker-action-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={17} />
            Nuevo ticket
          </button>
        ) : null}
      </section>

      <MaintainerToolbar searchId="support-ticket-search" searchValue={filters.search} searchPlaceholder="Buscar por ID, asunto o mensaje..." onSearchChange={(value) => setFilters((current) => ({ ...current, search: value }))}>
        <FilterSelect id="support-ticket-type" label="Tipo" value={filters.type} options={TYPE_OPTIONS} onChange={(value) => setFilters((current) => ({ ...current, type: value }))} />
        <FilterSelect id="support-ticket-status" label="Estado" value={filters.status} options={STATUS_OPTIONS} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} />
      </MaintainerToolbar>

      <MaintainerTable ariaLabel="Mis tickets" columns={COLUMNS} sortConfig={sortConfig} onSort={toggleSort} isLoading={isLoading} loadingText="Cargando tickets..." isEmpty={!result.tickets?.length} emptyText="No hay tickets con estos filtros." className="support-ticket-table" pagination={pagination}>
        {result.tickets?.map((ticket) => (
          <div className="maintainer-table-row support-ticket-row" role="row" key={ticket.id}>
            <span className="admin-user-cell">#{ticket.id}</span>
            <div className="admin-user-cell support-ticket-subject-cell">
              <strong>{ticket.subject}</strong>
            </div>
            <span className="admin-user-cell">{TYPE_LABELS[ticket.type] || ticket.type}</span>
            <time className="admin-user-cell">{formatPlatformDateTime(ticket.lastMessageAt)}</time>
            <span className={`admin-user-status ${getStatusClass(ticket.status)}`}>{STATUS_LABELS[ticket.status] || ticket.status}</span>
            <div className="admin-user-actions">
              <Tooltip label="Abrir conversación">
                <a
                  className="icon-tool-button support-ticket-open-action"
                  href={`/sugerencias-reclamos/${ticket.id}`}
                  aria-label={`Abrir ticket #${ticket.id}`}
                  onClick={(event) => {
                    if (!onNavigateToTicket) return;
                    event.preventDefault();
                    onNavigateToTicket(ticket.id);
                  }}
                >
                  <ExternalLink size={16} />
                </a>
              </Tooltip>
            </div>
          </div>
        ))}
      </MaintainerTable>

      {isCreateOpen ? (
        <MaintainerModal
          as="form"
          title="Nuevo ticket"
          subtitle="Describe el tema con claridad. La respuesta llegará a tu campana y quedará disponible como conversación."
          className="admin-modal support-ticket-create-modal"
          onClose={closeCreateModal}
          onSubmit={submitTicket}
          noValidate
          actions={(
            <>
              <button type="button" className="btn-modal btn-modal-secondary" onClick={closeCreateModal} disabled={isSaving}>Cancelar</button>
              <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
                <Send size={17} />
                Enviar ticket
              </button>
            </>
          )}
        >
          <div className="support-ticket-form-grid">
            <div className="notification-form-field">
              <label htmlFor="ticket-type">Tipo</label>
              <FormSelect id="ticket-type" label="Tipo" value={form.type} options={FORM_TYPE_OPTIONS} onChange={(value) => setForm((current) => ({ ...current, type: value }))} />
            </div>
            <div className="notification-form-field">
              <label htmlFor="ticket-subject">Asunto</label>
              <input
                id="ticket-subject"
                className="modal-input"
                value={form.subject}
                onChange={(event) => {
                  setForm((current) => ({ ...current, subject: event.target.value }));
                  if (formErrors.subject) setFormErrors((current) => ({ ...current, subject: "" }));
                }}
                maxLength={140}
                placeholder="Ej: Error al abrir un resubido"
                aria-describedby={formErrors.subject ? "ticket-subject-error" : undefined}
              />
              {formErrors.subject ? <span id="ticket-subject-error" className="field-error">{formErrors.subject}</span> : null}
            </div>
          </div>
          <div className="notification-form-field">
            <label htmlFor="ticket-body">Mensaje</label>
            <textarea
              id="ticket-body"
              value={form.body}
              onChange={(event) => {
                setForm((current) => ({ ...current, body: event.target.value }));
                if (formErrors.body) setFormErrors((current) => ({ ...current, body: "" }));
              }}
              rows={5}
              maxLength={4000}
              placeholder="Cuéntanos qué ocurrió o qué te gustaría proponer..."
              aria-describedby={formErrors.body ? "ticket-body-error" : undefined}
            />
            {formErrors.body ? <span id="ticket-body-error" className="field-error">{formErrors.body}</span> : null}
          </div>
          <div className="support-ticket-form-footer">
            <span>{form.body.trim().length}/4000</span>
          </div>
        </MaintainerModal>
      ) : null}
    </section>
  );
}
