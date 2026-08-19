import crypto from "node:crypto";

import { getPrismaClient } from "./prisma.js";
import { generateToken, hashToken } from "./tokenHash.js";
import { getPlatformUserById, getPublicAccessUser } from "./repositories/platformUserRepository.js";

// Independiente de PlatformSession (cookie web) - ver docs/backend-api.md del repo mobile.
// Tokens opacos, hasheados en servidor (nunca en texto plano en DB), revocación inmediata.
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutos
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 días, deslizante
const OAUTH_EXCHANGE_TTL_MS = 60 * 1000; // 60 segundos, un solo uso

function newFamilyId() {
  return crypto.randomUUID();
}

async function mintAccessToken(prisma, { userId, refreshFamilyId }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  await prisma.platformMobileAccessToken.create({
    data: { tokenHash: hashToken(token), userId, refreshFamilyId, expiresAt },
  });
  return { token, expiresAt };
}

async function mintRefreshToken(prisma, { userId, familyId, parentId, clientType, deviceId, createdIp, userAgent }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const row = await prisma.platformMobileRefreshToken.create({
    data: {
      familyId,
      tokenHash: hashToken(token),
      userId,
      clientType,
      deviceId: deviceId || null,
      parentId: parentId || null,
      expiresAt,
      createdIp: createdIp || null,
      userAgent: userAgent || null,
    },
  });
  return { token, expiresAt, row };
}

/** Emite un par access+refresh nuevo (login manual, OAuth, o canje de exchange code). */
export async function issueMobileSession(userId, { clientType, deviceId, ip, userAgent } = {}) {
  const prisma = getPrismaClient();
  const familyId = newFamilyId();
  const refresh = await mintRefreshToken(prisma, {
    userId,
    familyId,
    parentId: null,
    clientType: clientType || "unknown",
    deviceId,
    createdIp: ip,
    userAgent,
  });
  const access = await mintAccessToken(prisma, { userId, refreshFamilyId: familyId });

  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

/**
 * Rota un refresh token. Si el token presentado ya fue rotado o revocado, se asume compromiso:
 * se revoca toda la familia (todos los refresh tokens y access tokens vivos de esa cadena).
 */
export async function rotateRefreshToken(rawToken, { ip, userAgent } = {}) {
  const prisma = getPrismaClient();
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.platformMobileRefreshToken.findUnique({ where: { tokenHash } });

  if (!existing) {
    return { status: "invalid" };
  }

  if (existing.revokedAt || existing.rotatedAt || existing.expiresAt <= new Date()) {
    await revokeRefreshFamily(existing.familyId, "reuse_detected");
    return { status: "reuse_detected" };
  }

  const now = new Date();
  const refresh = await mintRefreshToken(prisma, {
    userId: existing.userId,
    familyId: existing.familyId,
    parentId: existing.id,
    clientType: existing.clientType,
    deviceId: existing.deviceId,
    createdIp: ip,
    userAgent,
  });

  await prisma.platformMobileRefreshToken.update({
    where: { id: existing.id },
    data: { rotatedAt: now, lastUsedAt: now },
  });

  const access = await mintAccessToken(prisma, { userId: existing.userId, refreshFamilyId: existing.familyId });

  return {
    status: "rotated",
    userId: existing.userId,
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

/** Revoca toda una cadena de rotación: sus refresh tokens y cualquier access token emitido bajo ella. */
export async function revokeRefreshFamily(familyId, reason = "logout") {
  const prisma = getPrismaClient();
  const now = new Date();
  await prisma.$transaction([
    prisma.platformMobileRefreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    }),
    prisma.platformMobileAccessToken.updateMany({
      where: { refreshFamilyId: familyId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}

/** Logout: revoca la familia dueña de este refresh token. Idempotente - token ya inválido no es error. */
export async function logoutRefreshToken(rawToken, reason = "logout") {
  const prisma = getPrismaClient();
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.platformMobileRefreshToken.findUnique({ where: { tokenHash } });
  if (existing) {
    await revokeRefreshFamily(existing.familyId, reason);
  }
}

/** Revoca todas las familias de un usuario - usado en borrado de cuenta. */
export async function revokeAllMobileSessionsForUser(userId) {
  const prisma = getPrismaClient();
  const families = await prisma.platformMobileRefreshToken.findMany({
    where: { userId },
    distinct: ["familyId"],
    select: { familyId: true },
  });

  for (const { familyId } of families) {
    await revokeRefreshFamily(familyId, "account_deleted");
  }
}

/** Valida un access token y devuelve el userId, o null. No lanza. */
export async function verifyMobileAccessToken(rawToken) {
  if (!rawToken) return null;

  const prisma = getPrismaClient();
  const tokenHash = hashToken(rawToken);
  const access = await prisma.platformMobileAccessToken.findUnique({ where: { tokenHash } });

  if (!access || access.revokedAt || access.expiresAt <= new Date()) {
    return null;
  }

  return access.userId;
}

/** Extrae y valida el Bearer token de la request; equivalente mobile de getCurrentUserFromToken. */
export async function getMobileUserIdFromRequest(request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return verifyMobileAccessToken(token);
}

export async function createOAuthExchange({ userId, provider, clientType }) {
  const prisma = getPrismaClient();
  const id = generateToken();
  const expiresAt = new Date(Date.now() + OAUTH_EXCHANGE_TTL_MS);
  await prisma.platformMobileOAuthExchange.create({
    data: { id, userId, provider, clientType, expiresAt },
  });
  return { code: id, expiresAt };
}

/** Canjea un exchange code de un solo uso por un par de tokens mobile. */
export async function consumeOAuthExchange(code, { ip, userAgent } = {}) {
  const prisma = getPrismaClient();
  const exchange = await prisma.platformMobileOAuthExchange.findUnique({ where: { id: code } });

  if (!exchange || exchange.consumedAt || exchange.expiresAt <= new Date()) {
    return null;
  }

  await prisma.platformMobileOAuthExchange.update({
    where: { id: code },
    data: { consumedAt: new Date() },
  });

  const session = await issueMobileSession(exchange.userId, { clientType: exchange.clientType, ip, userAgent });
  return { ...session, userId: exchange.userId };
}

/**
 * Equivalente mobile de ensureAnyPermissionAuthorized/ensurePermissionAuthorized (lib/serverAuth.js),
 * pero resolviendo la identidad desde el Bearer en vez de la cookie de sesión web. Invitado (sin
 * Authorization, o token inválido) cae a getPublicAccessUser(), igual que la web con visitantes
 * anónimos - así rutas de solo lectura como /lives pueden usar el mismo gate de permisos que ya
 * usa la web sin duplicar su significado.
 */
export async function getMobileAccessUser(request) {
  const userId = await getMobileUserIdFromRequest(request);
  if (!userId) return getPublicAccessUser();

  const user = await getPlatformUserById(userId);
  return user || getPublicAccessUser();
}
