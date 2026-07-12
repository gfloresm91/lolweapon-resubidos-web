import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import { IDENTITY_LINK_COOKIE, oauthCookieOptions } from "@/lib/googleOAuth";
import { readJsonRequest } from "@/lib/http";
import {
  auditLoginAttempt,
  clearLoginRateLimit,
  getClientIp,
  getRateLimitKey,
  isLoginRateLimited,
  recordFailedLogin,
  waitForUniformLoginResponse,
} from "@/lib/loginSecurity";
import {
  authenticateManualUser,
  consumeIdentityLinkAttempt,
  createPlatformSession,
} from "@/lib/repositories/platformUserRepository";

const LOGIN_ERROR = "Credenciales incorrectas";

async function failedLoginResponse(startedAt) {
  await waitForUniformLoginResponse(startedAt);
  return NextResponse.json(
    { success: false, error: LOGIN_ERROR },
    { status: 401 },
  );
}

export async function POST(request) {
  const startedAt = Date.now();
  const payload = await readJsonRequest(request);
  const { login, password } = payload || {};
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "";
  const rateLimitKey = getRateLimitKey({ ip, login });

  if (isLoginRateLimited(rateLimitKey)) {
    await auditLoginAttempt({ login, ip, userAgent, success: false, reason: "rate_limited" });
    return failedLoginResponse(startedAt);
  }

  const user = await authenticateManualUser({ login, password });

  if (!user) {
    recordFailedLogin(rateLimitKey);
    await auditLoginAttempt({ login, ip, userAgent, success: false, reason: "invalid_credentials" });
    return failedLoginResponse(startedAt);
  }

  clearLoginRateLimit(rateLimitKey);
  await auditLoginAttempt({ login, ip, userAgent, success: true, reason: "manual" });
  const pendingLinkId = request.cookies.get(IDENTITY_LINK_COOKIE)?.value;
  let linkedProvider = null;
  let linkWarning = null;
  if (pendingLinkId) {
    try {
      const linkResult = await consumeIdentityLinkAttempt(pendingLinkId, user.id);
      linkedProvider = linkResult.provider;
    } catch {
      linkWarning = "No se completó la vinculación pendiente. Si aún quieres conectar esa cuenta, inicia el proceso nuevamente desde tu perfil.";
    }
  }
  const session = await createPlatformSession(user.id);
  const response = NextResponse.json({ success: true, user: session.user, linkedProvider, linkWarning });
  setSessionCookie(response, request, session.token, session.expiresAt);
  response.cookies.set(IDENTITY_LINK_COOKIE, "", oauthCookieOptions(0));

  return response;
}
