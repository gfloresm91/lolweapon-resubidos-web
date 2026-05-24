import { getPrismaClient } from "@/lib/prisma";

const SENSITIVE_KEYS = new Set([
  "password",
  "confirmPassword",
  "confirmpassword",
  "passwordHash",
  "passwordhash",
  "passwordSalt",
  "passwordsalt",
  "token",
  "secret",
  "authorization",
]);

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function sanitizeValue(value) {
  if (value == null) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEYS.has(String(key).toLowerCase()))
        .map(([key, entryValue]) => [key, sanitizeValue(entryValue)]),
    );
  }

  return value;
}

function getRequestIp(request) {
  return request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request?.headers?.get("x-real-ip")
    || null;
}

export function getAuditRequestMetadata(request) {
  return {
    ipAddress: getRequestIp(request),
    userAgent: request?.headers?.get("user-agent") || null,
  };
}

export async function createAuditLog({
  actor = null,
  action,
  module,
  entityType,
  entityId = null,
  entityLabel = null,
  summary = null,
  before = null,
  after = null,
  metadata = null,
  request = null,
}) {
  if (!usePostgres()) {
    return null;
  }

  const prisma = getPrismaClient();
  const requestMetadata = getAuditRequestMetadata(request);

  try {
    return await prisma.auditLog.create({
      data: {
        actorUserId: actor?.id ? Number(actor.id) : null,
        actorUsername: actor?.login || null,
        actorAlias: actor?.alias || null,
        action,
        module,
        entityType,
        entityId: entityId == null ? null : String(entityId),
        entityLabel: entityLabel == null ? null : String(entityLabel),
        summary,
        before: before == null ? undefined : sanitizeValue(before),
        after: after == null ? undefined : sanitizeValue(after),
        metadata: metadata == null ? undefined : sanitizeValue(metadata),
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      },
    });
  } catch (error) {
    console.error("No se pudo registrar el historial administrativo:", error);
    return null;
  }
}

export async function listAuditLogs({
  module = "",
  entityType = "",
  entityId = "",
  action = "",
  limit = 80,
} = {}) {
  if (!usePostgres()) {
    return [];
  }

  const prisma = getPrismaClient();
  const take = Math.min(Math.max(Number(limit) || 80, 1), 200);
  let logs = [];

  try {
    logs = await prisma.auditLog.findMany({
      where: {
        ...(module ? { module } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId: String(entityId) } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  } catch (error) {
    console.error("No se pudo leer el historial administrativo:", error);
    return [];
  }

  return logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt?.toISOString() || null,
    actorUserId: log.actorUserId,
    actorUsername: log.actorUsername,
    actorAlias: log.actorAlias,
    action: log.action,
    module: log.module,
    entityType: log.entityType,
    entityId: log.entityId,
    entityLabel: log.entityLabel,
    summary: log.summary,
    before: log.before,
    after: log.after,
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
  }));
}
