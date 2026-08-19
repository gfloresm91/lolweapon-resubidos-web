import { jsonError, readJsonRequest } from "@/lib/http";
import { createOAuthExchange } from "@/lib/mobileAuth";
import { authenticateManualUser, consumeIdentityLinkAttempt } from "@/lib/repositories/platformUserRepository";

export async function POST(request) {
  const payload = await readJsonRequest(request);
  const { attemptId, login, password, clientType } = payload || {};

  if (!attemptId || !login || !password) {
    return jsonError("Faltan datos.", { status: 400 });
  }

  const user = await authenticateManualUser({ login, password });
  if (!user) {
    return jsonError("Credenciales incorrectas.", { status: 401 });
  }

  let linkResult;
  try {
    linkResult = await consumeIdentityLinkAttempt(attemptId, user.id);
  } catch (error) {
    return jsonError(error.message || "El enlace expiró. Intenta nuevamente.", { status: 400 });
  }

  const exchange = await createOAuthExchange({
    userId: user.id,
    provider: linkResult.provider,
    clientType: clientType || "unknown",
  });

  return Response.json({ success: true, exchangeCode: exchange.code });
}
