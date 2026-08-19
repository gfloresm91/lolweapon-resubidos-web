import { jsonError, readJsonRequest } from "@/lib/http";
import { getClientIp } from "@/lib/loginSecurity";
import { consumeOAuthExchange } from "@/lib/mobileAuth";
import { getPlatformUserById } from "@/lib/repositories/platformUserRepository";

export async function POST(request) {
  const payload = await readJsonRequest(request);
  const code = payload?.code;

  if (!code) {
    return jsonError("Falta code.", { status: 400 });
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "";
  const session = await consumeOAuthExchange(code, { ip, userAgent });

  if (!session) {
    return jsonError("El código de intercambio expiró o ya fue usado.", { status: 400 });
  }

  const user = await getPlatformUserById(session.userId);

  return Response.json({
    success: true,
    user,
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  });
}
