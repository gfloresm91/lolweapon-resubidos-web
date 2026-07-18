"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import FormSelect from "@/components/FormSelect";
import UserAvatar from "@/components/UserAvatar";
import { formatPlatformDateTime } from "@/lib/dateTime";

const STATUS_OPTIONS = [
  { value: "open", label: "Abierto" },
  { value: "in_review", label: "En revisión" },
  { value: "answered", label: "Respondido" },
  { value: "resolved", label: "Resuelto" },
  { value: "closed", label: "Cerrado" },
];

const TYPE_LABELS = {
  suggestion: "Sugerencia",
  claim: "Reclamo",
  technical: "Problema técnico",
  other: "Otro",
};

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((item) => [item.value, item.label]));
const LONG_MESSAGE_LENGTH = 700;
const LONG_MESSAGE_LINES = 8;

function getUserDisplayName(user, fallback = "Usuario") {
  return user?.alias || user?.login || fallback;
}

function getStatusClass(status) {
  if (status === "open") return "is-warning";
  if (status === "in_review") return "is-pending";
  if (status === "answered") return "is-active";
  if (status === "resolved") return "is-active";
  return "is-inactive";
}

function isLongMessage(body = "") {
  return body.length > LONG_MESSAGE_LENGTH || body.split("\n").length > LONG_MESSAGE_LINES;
}

function getTicketIdFromPath(admin) {
  if (typeof window === "undefined") return null;
  const pattern = admin ? /\/administracion\/tickets\/(\d+)/ : /\/sugerencias-reclamos\/(\d+)/;
  const [, ticketId] = window.location.pathname.match(pattern) || [];
  return ticketId || null;
}

export default function SupportTicketThreadPage({ initialTicket = null, currentUser = null, admin = false, canUpdate = false, onBack = null }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [routeTicketId, setRouteTicketId] = useState(() => getTicketIdFromPath(admin) || initialTicket?.id || null);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState(initialTicket?.status || "open");
  const [isLoading, setIsLoading] = useState(!initialTicket);
  const [isSending, setIsSending] = useState(false);
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [expandedMessageIds, setExpandedMessageIds] = useState(() => new Set());
  const messagesRef = useRef(null);
  const replyTextareaRef = useRef(null);

  const getCurrentTicketId = useCallback(() => {
    return getTicketIdFromPath(admin) || routeTicketId || ticket?.id || null;
  }, [admin, routeTicketId, ticket?.id]);

  const loadTicket = useCallback(async ({ showLoading = true } = {}) => {
    const ticketId = getCurrentTicketId();
    if (!ticketId) {
      setIsLoading(false);
      return;
    }

    if (showLoading) setIsLoading(true);
    try {
      const endpoint = admin ? `/api/admin/tickets/${ticketId}` : `/api/support-tickets/${ticketId}`;
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo cargar el ticket.");
      if (Number(data.ticket?.id) !== Number(getCurrentTicketId())) return;
      setTicket(data.ticket);
      setStatus(data.ticket.status);
    } catch (error) {
      toast.error(error.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [admin, getCurrentTicketId]);

  useEffect(() => {
    const nextTicketId = getTicketIdFromPath(admin) || initialTicket?.id || null;
    setRouteTicketId(nextTicketId);

    if (initialTicket && (!nextTicketId || Number(initialTicket.id) === Number(nextTicketId))) {
      setTicket(initialTicket);
      setStatus(initialTicket.status || "open");
      setIsLoading(false);
      return;
    }

    setTicket(null);
    setStatus("open");
    setIsLoading(Boolean(nextTicketId));
  }, [admin, initialTicket]);

  useEffect(() => {
    function syncTicketRoute() {
      const nextTicketId = getTicketIdFromPath(admin);
      setRouteTicketId(nextTicketId);

      if (nextTicketId && Number(ticket?.id) !== Number(nextTicketId)) {
        setTicket(null);
        setStatus("open");
        setBody("");
        setIsLoading(true);
      }
    }

    window.addEventListener("popstate", syncTicketRoute);
    window.addEventListener("kala:navigation", syncTicketRoute);

    return () => {
      window.removeEventListener("popstate", syncTicketRoute);
      window.removeEventListener("kala:navigation", syncTicketRoute);
    };
  }, [admin, ticket?.id]);

  useEffect(() => {
    setExpandedMessageIds(new Set());
  }, [ticket?.id]);

  useEffect(() => {
    const messages = messagesRef.current;
    if (!messages) return;

    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }, [ticket?.id, ticket?.messages?.length]);

  useEffect(() => {
    const textarea = replyTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [body]);

  useEffect(() => {
    let isMounted = true;
    if (ticket) return undefined;

    async function loadInitialTicket() {
      await loadTicket();
      if (!isMounted) return;
    }

    void loadInitialTicket();
    return () => { isMounted = false; };
  }, [loadTicket, ticket]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws`);
    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type !== "tickets:update") return;
        const currentTicketId = getCurrentTicketId();
        if (currentTicketId && Number(payload.ticketId) === Number(currentTicketId)) {
          void loadTicket({ showLoading: false });
        }
      } catch {
        /* ignore malformed payloads */
      }
    });
    return () => socket.close();
  }, [getCurrentTicketId, loadTicket]);

  async function sendMessage(event) {
    event?.preventDefault();
    const text = body.trim();
    if (!text) {
      toast.error("Escribe una respuesta antes de enviar.");
      return;
    }

    setIsSending(true);
    try {
      const endpoint = admin ? `/api/admin/tickets/${ticket.id}/messages` : `/api/support-tickets/${ticket.id}/messages`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo enviar la respuesta.");
      setTicket(data.ticket);
      setStatus(data.ticket.status);
      setBody("");
      toast.success(admin ? "Respuesta enviada al usuario." : "Respuesta agregada al ticket.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  }

  async function saveStatus(nextStatus) {
    setStatus(nextStatus);
    if (!admin || !canUpdate) return;
    setIsStatusSaving(true);
    try {
      const response = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo actualizar el estado.");
      setTicket(data.ticket);
      toast.success("Estado actualizado.");
    } catch (error) {
      toast.error(error.message);
      setStatus(ticket.status);
    } finally {
      setIsStatusSaving(false);
    }
  }

  function toggleMessageExpansion(messageId) {
    setExpandedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }

  function handleReplyKeyDown(event) {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      if (!isSending && body.trim()) {
        void sendMessage(event);
      }
    }
  }

  function goBackToList() {
    if (onBack) {
      onBack();
      return;
    }

    window.location.href = admin ? "/administracion/tickets" : "/sugerencias-reclamos";
  }

  if (isLoading) {
    return (
      <section className="support-ticket-page support-ticket-loading-state" aria-busy="true">
        <div className="empty-state">
          <div className="empty-state-text">Cargando ticket...</div>
        </div>
      </section>
    );
  }

  if (!ticket) {
    return (
      <section className="support-ticket-page support-ticket-loading-state">
        <div className="empty-state">
          <div className="empty-state-text">Ticket no encontrado.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="support-ticket-page support-ticket-thread-page">
      <header className="watching-header admin-users-header support-ticket-header">
        <button type="button" className="support-ticket-back-button" onClick={goBackToList}>
          {admin ? "Volver a tickets" : "Volver a sugerencias/reclamos"}
        </button>
        <h1 className="title">{ticket.subject}</h1>
        <p className="subtitle">
          {TYPE_LABELS[ticket.type] || ticket.type} creado por {getUserDisplayName(ticket.createdBy, "usuario")}.
        </p>
      </header>

      <section className="support-ticket-thread-layout">
        <aside className="support-ticket-summary" aria-label="Resumen del ticket">
          <div>
            <span>Ticket</span>
            <strong>#{ticket.id}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong className={`admin-user-status ${getStatusClass(ticket.status)}`}>{STATUS_LABELS[ticket.status] || ticket.status}</strong>
          </div>
          <div>
            <span>Tipo</span>
            <strong>{TYPE_LABELS[ticket.type] || ticket.type}</strong>
          </div>
          <div>
            <span>Creado</span>
            <time>{formatPlatformDateTime(ticket.createdAt)}</time>
          </div>
          <div>
            <span>Última actividad</span>
            <time>{formatPlatformDateTime(ticket.lastMessageAt)}</time>
          </div>
          {admin && canUpdate ? (
            <div className="support-ticket-status-control">
              <label htmlFor="ticket-status">Cambiar estado</label>
              <FormSelect id="ticket-status" label="Estado" value={status} options={STATUS_OPTIONS} onChange={saveStatus} disabled={isStatusSaving} />
            </div>
          ) : null}
        </aside>

        <div className="support-ticket-thread-panel">
          <div ref={messagesRef} className="support-ticket-messages" aria-label="Conversación del ticket">
            {ticket.messages?.map((message, index) => {
              const longMessage = isLongMessage(message.body);
              const isExpanded = expandedMessageIds.has(message.id);
              const authorName = getUserDisplayName(message.author);
              const isCurrentUserAuthor = Number(message.author?.id) === Number(currentUser?.id);
              const isOwnMessage = admin ? Boolean(message.isAdmin) : isCurrentUserAuthor;
              const sideClassName = isOwnMessage ? "is-own" : "is-other";
              const authorClassName = message.isAdmin ? "is-admin" : "is-user";
              const previousMessage = ticket.messages[index - 1];
              const previousIsCurrentUserAuthor = Number(previousMessage?.author?.id) === Number(currentUser?.id);
              const previousIsOwnMessage = previousMessage ? (admin ? Boolean(previousMessage.isAdmin) : previousIsCurrentUserAuthor) : false;
              const isGroupedWithPrevious = Boolean(
                previousMessage
                && previousIsOwnMessage === isOwnMessage
                && Number(previousMessage.author?.id) === Number(message.author?.id),
              );
              const rowClassName = [
                "support-ticket-message-row",
                sideClassName,
                authorClassName,
                isGroupedWithPrevious ? "is-grouped" : "",
              ].filter(Boolean).join(" ");

              return (
                <div className={rowClassName} key={message.id}>
                  {!isOwnMessage ? <UserAvatar user={message.author} className="support-ticket-message-avatar" /> : null}
                  <article className={`support-ticket-message ${sideClassName} ${authorClassName}`}>
                    <div className="support-ticket-message-meta">
                      <span className="support-ticket-message-author">
                        {message.isAdmin ? <span className="support-ticket-message-role">Administración</span> : null}
                        <strong>{authorName}</strong>
                      </span>
                      <time>{formatPlatformDateTime(message.createdAt)}</time>
                    </div>
                    <p className={`support-ticket-message-body ${longMessage && !isExpanded ? "is-collapsed" : ""}`.trim()}>{message.body}</p>
                    {longMessage ? (
                      <button type="button" className="support-ticket-message-toggle" onClick={() => toggleMessageExpansion(message.id)}>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        {isExpanded ? "Contraer" : "Ver completo"}
                      </button>
                    ) : null}
                  </article>
                </div>
              );
            })}
          </div>

          {ticket.status === "closed" ? (
            <div className="support-ticket-closed-note">
              <CheckCircle2 size={17} />
              {admin ? "Este ticket está cerrado. Reábrelo antes de responder." : "Este ticket está cerrado. Puedes crear uno nuevo si necesitas continuar con otro tema."}
            </div>
          ) : (
            <form className="support-ticket-reply-form" onSubmit={sendMessage} noValidate>
              <label htmlFor="ticket-reply">{admin ? "Responder al usuario" : "Agregar respuesta"}</label>
              <textarea
                id="ticket-reply"
                ref={replyTextareaRef}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={handleReplyKeyDown}
                rows={4}
                maxLength={4000}
                placeholder={admin ? "Escribe la respuesta que recibirá el usuario..." : "Agrega más contexto si lo necesitas..."}
              />
              <div className="support-ticket-form-footer">
                <span>
                  {body.trim().length}/4000
                  <kbd>Ctrl</kbd> + <kbd>Enter</kbd> para enviar
                </span>
                <button type="submit" className={`tracker-action-primary ${isSending ? "is-loading" : ""}`.trim()} disabled={isSending || !body.trim()}>
                  <SendHorizontal size={18} />
                  Enviar
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </section>
  );
}
