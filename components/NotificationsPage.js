"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, BookOpen, CheckCheck, CirclePlay, ExternalLink, Eye, EyeOff, MessageSquare, Radio, RotateCcw, ShieldAlert, Sparkles, Trash2, Tv, Video } from "lucide-react";
import { toast } from "sonner";

import AppLink from "@/components/AppLink";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";
import Tooltip from "@/components/Tooltip";
import { formatPlatformDateTime } from "@/lib/dateTime";

const TYPE_OPTIONS = [{ value: "all", label: "Todos los tipos" }, { value: "alert", label: "Alertas" }, { value: "activity", label: "Actividad" }, { value: "system", label: "Sistema" }];
const STATUS_OPTIONS = [{ value: "all", label: "Todos los estados" }, { value: "active", label: "Activas" }, { value: "unread", label: "No leídas" }, { value: "read", label: "Leídas" }, { value: "dismissed", label: "Descartadas" }];
const COLUMNS = [
  { key: "notification", label: "Notificación" },
  { key: "type", label: "Tipo", sortable: true },
  { key: "published", label: "Fecha", sortable: true },
  { key: "state", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];
const ICONS = { Bell, BellRing, BookOpen, CheckCheck, CirclePlay, MessageSquare, Radio, ShieldAlert, Sparkles, Tv, Video };
const TYPE_LABELS = { alert: "Alerta", activity: "Actividad", system: "Sistema" };

function getNotificationIcon(notification) {
  return ICONS[notification.icon] || (
    notification.type === "alert"
      ? ShieldAlert
      : notification.type === "system"
        ? Sparkles
        : Bell
  );
}

function getActionMessage(action) {
  if (action === "mark-read") return "Notificación marcada como leída.";
  if (action === "mark-unread") return "Notificación marcada como no leída.";
  if (action === "dismiss") return "Notificación descartada.";
  if (action === "restore") return "Notificación restaurada.";
  if (action === "mark-all-read") return "Todas las notificaciones visibles fueron marcadas como leídas.";
  return "Notificación actualizada.";
}

function getNotificationState(notification) {
  if (notification.isDismissed) {
    return { label: "Descartada", className: "is-inactive" };
  }

  if (notification.isRead) {
    return { label: "Leída", className: "is-active" };
  }

  return { label: "No leída", className: "is-warning" };
}

function NotificationDestinationLink({ notification, children, ...props }) {
  if (notification.type === "alert") {
    return (
      <a href={notification.href} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  }

  return (
    <AppLink href={notification.href} {...props}>
      {children}
    </AppLink>
  );
}

export default function NotificationsPage({ initialResult = null }) {
  const [result, setResult] = useState(initialResult || { notifications: [], total: 0, unreadCount: 0, dismissedCount: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "published", direction: "desc" });
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingDismiss, setPendingDismiss] = useState(null);

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        type,
        status,
        page: String(page),
        pageSize: String(pageSize),
        sort: sortConfig.key,
        direction: sortConfig.direction,
      });
      const response = await fetch(`/api/notifications?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudieron cargar las notificaciones.");
      setResult(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [page, pageSize, search, sortConfig, status, type]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, type]);
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws`);
    socket.addEventListener("message", (event) => {
      try { if (JSON.parse(event.data)?.type === "notifications:update") void load({ showLoading: false }); } catch { /* ignore malformed payloads */ }
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
  const mobilePageSizeOptions = useMemo(() => {
    const options = [10, 25, 50, 100].map((value) => ({ value: String(value), label: String(value) }));

    if (result.total > 0) {
      options.push({ value: "all", label: "Todos" });
    }

    return options;
  }, [result.total]);
  const mobilePageSizeValue = useMemo(() => (
    result.total > 0 && Number(pageSize) === Number(result.total) && ![10, 25, 50, 100].includes(Number(pageSize))
      ? "all"
      : String(pageSize)
  ), [pageSize, result.total]);

  function changePageSize(value) {
    setPageSize(value === "all" ? Math.max(1, Number(result.total) || 1) : Number(value));
    setPage(1);
  }

  function toggleSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }

  async function runAction(action, id = null) {
    const scrollY = window.scrollY;
    setIsMutating(true);
    try {
      const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) });
      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.error || "No se pudo actualizar la notificación.");
        return false;
      }
      toast.success(getActionMessage(action));
      await load({ showLoading: false });
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: "auto" }));
      return true;
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="notifications-page">
      <header className="watching-header admin-users-header">
        <h1 className="title">Tus <span className="text-gradient">notificaciones</span></h1>
        <p className="subtitle">Consulta, organiza y recupera todos tus avisos desde un solo lugar.</p>
      </header>
      <MaintainerStats items={[
        { label: "Resultados", value: result.total || 0, color: "purple" },
        { label: "No leídas", value: result.unreadCount || 0, color: "orange" },
        { label: "Descartadas", value: result.dismissedCount || 0, color: "blue" },
      ]} />
      <section className="tracker-actions notification-page-actions">
        <div><span className="tracker-actions-label">Bandeja</span><p className="tracker-actions-copy">Los avisos descartados pueden restaurarse cuando quieras.</p></div>
        <button type="button" className="tracker-action-secondary" onClick={() => runAction("mark-all-read")} disabled={isMutating || !result.unreadCount}><CheckCheck size={17} /> Marcar todas como leídas</button>
      </section>
      <MaintainerToolbar searchId="notification-search" searchValue={search} searchPlaceholder="Buscar por título o contenido..." onSearchChange={setSearch}>
        <FilterSelect id="notification-type" label="Tipo" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <FilterSelect id="notification-status" label="Estado" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </MaintainerToolbar>
      <section className="notification-mobile-list" aria-label="Centro de notificaciones">
        {isLoading ? (
          <div className="notification-mobile-empty">
            Cargando notificaciones...
          </div>
        ) : !result.notifications?.length ? (
          <div className="notification-mobile-empty">
            No hay notificaciones con estos filtros.
          </div>
        ) : result.notifications.map((notification) => {
          const Icon = getNotificationIcon(notification);
          const state = getNotificationState(notification);
          const readAction = notification.isRead ? "mark-unread" : "mark-read";
          const dismissAction = notification.isDismissed ? "restore" : "dismiss";
          const readLabel = notification.isRead ? "No leída" : "Leída";
          const dismissLabel = notification.isDismissed ? "Restaurar" : "Descartar";

          return (
            <article
              className={`notification-mobile-card ${notification.isRead ? "" : "is-unread"} ${notification.isDismissed ? "is-dismissed" : ""}`}
              key={notification.id}
            >
              <span className={`notification-page-card-icon is-${notification.severity}`} aria-hidden="true">
                <Icon size={18} />
              </span>
              <div className="notification-mobile-card-content">
                <div className="notification-mobile-card-heading">
                  <h2>{notification.title}</h2>
                  <span className={`admin-user-status ${state.className}`}>{state.label}</span>
                </div>
                {notification.body ? <p>{notification.body}</p> : null}
                <div className="notification-mobile-meta">
                  <span>{TYPE_LABELS[notification.type] || notification.type}</span>
                  <time>{formatPlatformDateTime(notification.publishedAt || notification.createdAt)}</time>
                </div>
                <div
                  className="notification-mobile-actions"
                  style={{ "--notification-mobile-action-count": notification.href ? 3 : 2 }}
                >
                  {notification.href ? (
                    <Tooltip label="Abrir contenido">
                      <NotificationDestinationLink notification={notification} className="notification-mobile-action" aria-label={`Abrir contenido de ${notification.title}`}>
                        <ExternalLink size={15} />
                        <span>Abrir</span>
                      </NotificationDestinationLink>
                    </Tooltip>
                  ) : null}
                  <Tooltip label={`Marcar como ${readLabel.toLowerCase()}`}>
                    <button type="button" className="notification-mobile-action" onClick={() => runAction(readAction, notification.id)} disabled={isMutating} aria-label={`Marcar como ${readLabel.toLowerCase()}`}>
                      {notification.isRead ? <EyeOff size={15} /> : <Eye size={15} />}
                      <span>{readLabel}</span>
                    </button>
                  </Tooltip>
                  <Tooltip label={dismissLabel}>
                    <button type="button" className="notification-mobile-action is-danger" onClick={() => notification.isDismissed ? runAction(dismissAction, notification.id) : setPendingDismiss(notification)} disabled={isMutating} aria-label={dismissLabel}>
                      {notification.isDismissed ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                      <span>{dismissLabel}</span>
                    </button>
                  </Tooltip>
                </div>
              </div>
            </article>
          );
        })}
        <div className="notification-mobile-pagination" aria-label="Paginación móvil">
          <span>{pagination.from}-{pagination.to} de {pagination.total}</span>
          <FilterSelect
            id="notification-mobile-page-size"
            label="Filas"
            value={mobilePageSizeValue}
            options={mobilePageSizeOptions}
            onChange={changePageSize}
          />
          <div>
            <button type="button" onClick={pagination.onPrevious} disabled={!pagination.canPrevious}>Anterior</button>
            <button type="button" onClick={pagination.onNext} disabled={!pagination.canNext}>Siguiente</button>
          </div>
        </div>
      </section>
      <MaintainerTable ariaLabel="Centro de notificaciones" columns={COLUMNS} sortConfig={sortConfig} onSort={toggleSort} isLoading={isLoading} loadingText="Cargando notificaciones..." isEmpty={!result.notifications?.length} emptyText="No hay notificaciones con estos filtros." className="notification-user-table" pagination={pagination}>
        {result.notifications?.map((notification) => {
          const Icon = getNotificationIcon(notification);
          const state = getNotificationState(notification);
          const readAction = notification.isRead ? "mark-unread" : "mark-read";
          const dismissAction = notification.isDismissed ? "restore" : "dismiss";
          const readLabel = notification.isRead ? "Marcar como no leída" : "Marcar como leída";
          const dismissLabel = notification.isDismissed ? "Restaurar" : "Descartar";

          return (
            <div className={`maintainer-table-row notification-user-row ${notification.isRead ? "" : "is-unread"} ${notification.isDismissed ? "is-dismissed" : ""}`} role="row" key={notification.id}>
              <div className="notification-user-main">
                <span className={`notification-page-card-icon is-${notification.severity}`} aria-hidden="true"><Icon size={19} /></span>
                <div className="notification-page-card-copy">
                  <h2>{notification.title}</h2>
                  {notification.body ? <p>{notification.body}</p> : null}
                </div>
              </div>
              <span className="admin-user-cell">{TYPE_LABELS[notification.type] || notification.type}</span>
              <time className="admin-user-cell">{formatPlatformDateTime(notification.publishedAt || notification.createdAt)}</time>
              <span className={`admin-user-status ${state.className}`}>{state.label}</span>
              <div className="admin-user-actions notification-page-card-actions">
                {notification.href ? (
                  <Tooltip label="Abrir contenido">
                    <NotificationDestinationLink notification={notification} className="icon-tool-button" aria-label={`Abrir contenido de ${notification.title}`}>
                      <ExternalLink size={16} />
                    </NotificationDestinationLink>
                  </Tooltip>
                ) : null}
                <Tooltip label={readLabel}>
                  <button type="button" className="icon-tool-button" aria-label={readLabel} onClick={() => runAction(readAction, notification.id)} disabled={isMutating}>{notification.isRead ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </Tooltip>
                <Tooltip label={dismissLabel}>
                  <button type="button" className="icon-tool-button danger" aria-label={dismissLabel} onClick={() => notification.isDismissed ? runAction(dismissAction, notification.id) : setPendingDismiss(notification)} disabled={isMutating}>{notification.isDismissed ? <RotateCcw size={16} /> : <Trash2 size={16} />}</button>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </MaintainerTable>
      <ConfirmModal
        isOpen={Boolean(pendingDismiss)}
        title="Descartar notificación"
        description={pendingDismiss ? `“${pendingDismiss.title}” saldrá de tu bandeja principal. Podrás recuperarla desde el filtro Descartadas.` : ""}
        confirmLabel="Descartar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isMutating}
        onConfirm={async () => {
          if (!pendingDismiss) return;
          const success = await runAction("dismiss", pendingDismiss.id);
          if (success) setPendingDismiss(null);
        }}
        onCancel={() => setPendingDismiss(null)}
      />
    </section>
  );
}
