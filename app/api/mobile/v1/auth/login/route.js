import { jsonError, readJsonRequest } from "@/lib/http";
import {
  auditLoginAttempt,
  clearLoginRateLimit,
  getClientIp,
  getRateLimitKey,
  isLoginRateLimited,
  recordFailedLogin,
  waitForUniformLoginResponse,
} from "@/lib/loginSecurity";
import { issueMobileSession } from "@/lib/mobileAuth";
import { authenticateManualUser } from "@/lib/repositories/platformUserRepository";

const LOGIN_ERROR = "Credenciales incorrectas";

async function failedLoginResponse(startedAt) {
  await waitForUniformLoginResponse(startedAt);
  return jsonError(LOGIN_ERROR, { status: 401 });
}

export async function POST(request) {
  const startedAt = Date.now();
  const payload = await readJsonRequest(request);
  const { login, password, clientType, deviceId } = payload || {};
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

  const session = await issueMobileSession(user.id, { clientType: clientType || "unknown", deviceId, ip, userAgent });

  return Response.json({ success: true, user, ...session });
}
