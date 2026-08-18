import { jsonError, readJsonRequest } from "@/lib/http";
import { getClientIp } from "@/lib/loginSecurity";
import { rotateRefreshToken } from "@/lib/mobileAuth";

export async function POST(request) {
  const payload = await readJsonRequest(request);
  const refreshToken = payload?.refreshToken;

  if (!refreshToken) {
    return jsonError("Falta refreshToken.", { status: 400 });
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "";
  const result = await rotateRefreshToken(refreshToken, { ip, userAgent });

  if (result.status === "invalid") {
    return jsonError("Refresh token inválido.", { status: 401 });
  }

  if (result.status === "reuse_detected") {
    return jsonError("Sesión revocada. Inicia sesión nuevamente.", { status: 401 });
  }

  return Response.json({
    success: true,
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.accessTokenExpiresAt,
    refreshToken: result.refreshToken,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
  });
}
