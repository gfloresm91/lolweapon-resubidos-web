import { getPrismaClient } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MIN_RESPONSE_MS = 450;
const DEFAULT_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const globalForLoginSecurity = globalThis;

if (!globalForLoginSecurity.__lolweaponLoginAttempts) {
  globalForLoginSecurity.__lolweaponLoginAttempts = new Map();
}

if (!globalForLoginSecurity.__lolweaponLoginAttemptCleanupAt) {
  globalForLoginSecurity.__lolweaponLoginAttemptCleanupAt = 0;
}

const attempts = globalForLoginSecurity.__lolweaponLoginAttempts;

function getLoginAttemptRetentionDays() {
  const configuredDays = Number.parseInt(process.env.LOGIN_ATTEMPT_RETENTION_DAYS || "", 10);
  return Number.isInteger(configuredDays) && configuredDays > 0
    ? configuredDays
    : DEFAULT_RETENTION_DAYS;
}

async function cleanupExpiredLoginAttempts(prisma) {
  const now = Date.now();
  if (now - globalForLoginSecurity.__lolweaponLoginAttemptCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  globalForLoginSecurity.__lolweaponLoginAttemptCleanupAt = now;
  const createdBefore = new Date(now - getLoginAttemptRetentionDays() * 24 * 60 * 60 * 1000);
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: createdBefore } },
  });
}

function normalizeKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

export function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function getRateLimitKey({ ip, login }) {
  return `${normalizeKeyPart(ip)}:${normalizeKeyPart(login)}`;
}

export function isLoginRateLimited(key) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry) {
    return false;
  }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return true;
  }

  if (entry.firstAttemptAt + WINDOW_MS <= now) {
    attempts.delete(key);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(key) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.firstAttemptAt + WINDOW_MS <= now) {
    attempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: null,
    });
    return;
  }

  const nextCount = entry.count + 1;
  attempts.set(key, {
    ...entry,
    count: nextCount,
    blockedUntil: nextCount >= MAX_ATTEMPTS ? now + BLOCK_MS : entry.blockedUntil,
  });
}

export function clearLoginRateLimit(key) {
  attempts.delete(key);
}

export async function waitForUniformLoginResponse(startedAt) {
  const elapsed = Date.now() - startedAt;
  const waitMs = Math.max(0, MIN_RESPONSE_MS - elapsed);

  if (waitMs) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export async function auditLoginAttempt({ login, ip, userAgent, success, reason }) {
  try {
    const prisma = getPrismaClient();
    await prisma.loginAttempt.create({
      data: {
        login: normalizeKeyPart(login) || null,
        ip: ip || null,
        userAgent: userAgent || null,
        success,
        reason: reason || null,
      },
    });
    await cleanupExpiredLoginAttempts(prisma);
  } catch {
    // Login auditing must never break authentication flow.
  }
}
