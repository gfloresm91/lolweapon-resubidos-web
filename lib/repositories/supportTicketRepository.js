import { getPrismaClient } from "../prisma.js";
import { broadcastTicketUpdate } from "../notificationRealtime.js";
import { createPlatformNotification } from "./notificationRepository.js";

export const SUPPORT_TICKET_TYPES = [
  { value: "suggestion", label: "Sugerencia" },
  { value: "claim", label: "Reclamo" },
  { value: "technical", label: "Problema técnico" },
  { value: "other", label: "Otro" },
];

export const SUPPORT_TICKET_STATUSES = [
  { value: "open", label: "Abierto" },
  { value: "in_review", label: "En revisión" },
  { value: "answered", label: "Respondido" },
  { value: "resolved", label: "Resuelto" },
  { value: "closed", label: "Cerrado" },
];

const VALID_TYPES = new Set(SUPPORT_TICKET_TYPES.map((item) => item.value));
const VALID_STATUSES = new Set(SUPPORT_TICKET_STATUSES.map((item) => item.value));
const MAX_PAGE_SIZE = 100;
const USER_INCLUDE = { select: { id: true, login: true, alias: true, email: true, avatarUrl: true } };
const TICKET_INCLUDE = {
  createdBy: USER_INCLUDE,
  messages: {
    include: { author: USER_INCLUDE },
    orderBy: { createdAt: "asc" },
  },
};

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function normalizePage(value) {
  return Math.max(Number(value) || 1, 1);
}

function normalizePageSize(value) {
  return Math.min(Math.max(Number(value) || 10, 1), MAX_PAGE_SIZE);
}

function normalizeType(value) {
  const type = String(value || "").trim().toLowerCase();
  return VALID_TYPES.has(type) ? type : "other";
}

function normalizeStatus(value, fallback = "open") {
  const status = String(value || "").trim().toLowerCase();
  return VALID_STATUSES.has(status) ? status : fallback;
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function compactUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    login: user.login,
    alias: user.alias,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}

function compactMessage(message) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    body: message.body,
    isAdmin: message.isAdmin,
    createdAt: message.createdAt?.toISOString() || null,
    author: compactUser(message.author),
  };
}

function compactTicket(ticket, { includeMessages = false } = {}) {
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  const lastMessage = messages[messages.length - 1] || null;

  return {
    id: ticket.id,
    type: ticket.type,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt?.toISOString() || null,
    updatedAt: ticket.updatedAt?.toISOString() || null,
    lastMessageAt: ticket.lastMessageAt?.toISOString() || null,
    closedAt: ticket.closedAt?.toISOString() || null,
    createdBy: compactUser(ticket.createdBy),
    messageCount: ticket._count?.messages ?? messages.length,
    lastMessage: lastMessage ? compactMessage(lastMessage) : null,
    messages: includeMessages ? messages.map(compactMessage) : undefined,
  };
}

function getNextStatusAfterMessage(ticketStatus, admin) {
  if (ticketStatus === "closed") {
    throw new Error("El ticket está cerrado. Reábrelo antes de responder.");
  }

  if (admin) {
    return ["resolved", "answered"].includes(ticketStatus) ? ticketStatus : "answered";
  }

  return "open";
}

function broadcastSupportTicketUpdate(ticket, payload = {}) {
  if (!ticket?.id) return;
  broadcastTicketUpdate({
    ticketId: ticket.id,
    createdByUserId: ticket.createdByUserId,
    status: ticket.status,
    ...payload,
  });
}

function buildSearchWhere(search) {
  const value = String(search || "").trim();
  if (!value) return {};

  const numericId = Number(value.replace(/^#/, ""));
  return {
    OR: [
      Number.isFinite(numericId) && numericId > 0 ? { id: numericId } : null,
      { subject: { contains: value, mode: "insensitive" } },
      { type: { contains: value, mode: "insensitive" } },
      { status: { contains: value, mode: "insensitive" } },
      { createdBy: { alias: { contains: value, mode: "insensitive" } } },
      { createdBy: { login: { contains: value, mode: "insensitive" } } },
      { messages: { some: { body: { contains: value, mode: "insensitive" } } } },
    ].filter(Boolean),
  };
}

function getOrderBy(sort = "lastMessageAt", direction = "desc") {
  const normalizedDirection = direction === "asc" ? "asc" : "desc";
  const allowed = new Set(["id", "type", "subject", "status", "createdAt", "lastMessageAt"]);
  return { [allowed.has(sort) ? sort : "lastMessageAt"]: normalizedDirection };
}

async function notifyAdminsAboutNewTicket(ticket) {
  await createPlatformNotification({
    type: "activity",
    severity: "info",
    source: "support-ticket",
    title: "Nuevo ticket recibido",
    body: `${ticket.createdBy?.alias || ticket.createdBy?.login || "Un usuario"} envió: ${ticket.subject}`,
    href: `/administracion/tickets/${ticket.id}`,
    icon: "MessageSquare",
    audience: "permission:admin.tickets.view",
    metadata: { ticketId: ticket.id, ticketType: ticket.type, userId: ticket.createdByUserId },
  });
}

async function notifyUserAboutAdminReply(ticket, actor) {
  if (!ticket?.createdByUserId || Number(ticket.createdByUserId) === Number(actor?.id)) return;
  await createPlatformNotification({
    type: "activity",
    severity: "success",
    source: "support-ticket",
    title: `Actualización en tu ticket #${ticket.id}`,
    body: ticket.subject,
    href: `/sugerencias-reclamos/${ticket.id}`,
    icon: "MessageSquare",
    audience: `user:${ticket.createdByUserId}`,
    actor,
    metadata: { ticketId: ticket.id, ticketType: ticket.type },
  });
}

export async function listUserSupportTickets({ user, page = 1, pageSize = 10, search = "", status = "all", type = "all", sort = "lastMessageAt", direction = "desc" } = {}) {
  if (!usePostgres() || !user?.id) {
    return { tickets: [], total: 0, page: 1, totalPages: 1, stats: {} };
  }

  const prisma = getPrismaClient();
  const currentPage = normalizePage(page);
  const take = normalizePageSize(pageSize);
  const where = {
    createdByUserId: Number(user.id),
    ...(status !== "all" ? { status: normalizeStatus(status) } : {}),
    ...(type !== "all" ? { type: normalizeType(type) } : {}),
    ...buildSearchWhere(search),
  };

  const [tickets, total, grouped] = await prisma.$transaction([
    prisma.supportTicket.findMany({
      where,
      include: {
        createdBy: USER_INCLUDE,
        messages: { include: { author: USER_INCLUDE }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: getOrderBy(sort, direction),
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.groupBy({
      by: ["status"],
      where: { createdByUserId: Number(user.id) },
      _count: { _all: true },
    }),
  ]);

  return {
    tickets: tickets.map(compactTicket),
    total,
    page: currentPage,
    totalPages: Math.max(1, Math.ceil(total / take)),
    stats: Object.fromEntries(grouped.map((item) => [item.status, item._count._all])),
  };
}

export async function listAdminSupportTickets({ page = 1, pageSize = 10, search = "", status = "all", type = "all", sort = "lastMessageAt", direction = "desc" } = {}) {
  if (!usePostgres()) {
    return { tickets: [], total: 0, page: 1, totalPages: 1, stats: {} };
  }

  const prisma = getPrismaClient();
  const currentPage = normalizePage(page);
  const take = normalizePageSize(pageSize);
  const where = {
    ...(status !== "all" ? { status: normalizeStatus(status) } : {}),
    ...(type !== "all" ? { type: normalizeType(type) } : {}),
    ...buildSearchWhere(search),
  };

  const [tickets, total, grouped] = await prisma.$transaction([
    prisma.supportTicket.findMany({
      where,
      include: {
        createdBy: USER_INCLUDE,
        messages: { include: { author: USER_INCLUDE }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: getOrderBy(sort, direction),
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return {
    tickets: tickets.map(compactTicket),
    total,
    page: currentPage,
    totalPages: Math.max(1, Math.ceil(total / take)),
    stats: Object.fromEntries(grouped.map((item) => [item.status, item._count._all])),
  };
}

export async function getSupportTicket({ ticketId, user = null, admin = false } = {}) {
  if (!usePostgres() || !ticketId) return null;

  const prisma = getPrismaClient();
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: Number(ticketId),
      ...(admin ? {} : { createdByUserId: Number(user?.id || 0) }),
    },
    include: TICKET_INCLUDE,
  });

  return ticket ? compactTicket(ticket, { includeMessages: true }) : null;
}

export async function createSupportTicket({ user, type, subject, body }) {
  if (!usePostgres() || !user?.id) return null;

  const prisma = getPrismaClient();
  const normalizedSubject = normalizeText(subject, 140);
  const normalizedBody = normalizeText(body, 4000);
  if (!normalizedSubject || !normalizedBody) {
    throw new Error("El asunto y el mensaje son obligatorios.");
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      createdByUserId: Number(user.id),
      type: normalizeType(type),
      subject: normalizedSubject,
      status: "open",
      messages: {
        create: {
          authorId: Number(user.id),
          body: normalizedBody,
          isAdmin: false,
        },
      },
    },
    include: TICKET_INCLUDE,
  });

  await notifyAdminsAboutNewTicket(ticket);
  broadcastSupportTicketUpdate(ticket, { action: "ticket.created", actorUserId: Number(user.id) });
  return compactTicket(ticket, { includeMessages: true });
}

export async function addSupportTicketMessage({ ticketId, user, body, admin = false }) {
  if (!usePostgres() || !ticketId || !user?.id) return null;

  const prisma = getPrismaClient();
  const normalizedBody = normalizeText(body, 4000);
  if (!normalizedBody) {
    throw new Error("La respuesta no puede estar vacía.");
  }

  const now = new Date();
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: Number(ticketId),
      ...(admin ? {} : { createdByUserId: Number(user.id) }),
    },
  });

  if (!ticket) return null;
  const nextStatus = getNextStatusAfterMessage(ticket.status, admin);

  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId: Number(ticketId),
        authorId: Number(user.id),
        body: normalizedBody,
        isAdmin: Boolean(admin),
      },
    }),
    prisma.supportTicket.update({
      where: { id: Number(ticketId) },
      data: {
        lastMessageAt: now,
        status: nextStatus,
        closedAt: ["resolved", "closed"].includes(nextStatus) ? ticket.closedAt : null,
      },
    }),
  ]);

  const updated = await prisma.supportTicket.findUnique({ where: { id: Number(ticketId) }, include: TICKET_INCLUDE });
  if (admin) {
    await notifyUserAboutAdminReply(updated, user);
  } else {
    await notifyAdminsAboutNewTicket(updated);
  }
  broadcastSupportTicketUpdate(updated, {
    action: "ticket.message.created",
    actorUserId: Number(user.id),
    isAdmin: Boolean(admin),
  });

  return compactTicket(updated, { includeMessages: true });
}

export async function updateSupportTicketStatus({ ticketId, status, actor }) {
  if (!usePostgres() || !ticketId) return null;

  const prisma = getPrismaClient();
  const normalizedStatus = normalizeStatus(status);
  const ticket = await prisma.supportTicket.update({
    where: { id: Number(ticketId) },
    data: {
      status: normalizedStatus,
      closedAt: ["resolved", "closed"].includes(normalizedStatus) ? new Date() : null,
    },
    include: TICKET_INCLUDE,
  });

  if (["resolved", "closed"].includes(normalizedStatus)) {
    await notifyUserAboutAdminReply(ticket, actor);
  }
  broadcastSupportTicketUpdate(ticket, {
    action: "ticket.status.updated",
    actorUserId: actor?.id ? Number(actor.id) : null,
  });

  return compactTicket(ticket, { includeMessages: true });
}
