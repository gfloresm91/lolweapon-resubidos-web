import { jsonError, readJsonRequest } from "@/lib/http";
import { createOAuthExchange } from "@/lib/mobileAuth";
import { registerOAuthUser } from "@/lib/repositories/platformUserRepository";

export async function POST(request) {
  const payload = await readJsonRequest(request);
  const { attemptId, login, alias, clientType } = payload || {};

  if (!attemptId || !login || !alias) {
    return jsonError("Faltan datos.", { status: 400 });
  }

  let user;
  try {
    user = await registerOAuthUser({ login, alias }, attemptId);
  } catch (error) {
    return jsonError(error.message || "No se pudo completar el registro.", { status: 400 });
  }

  const provider = user.authIdentities?.[0]?.provider || "unknown";
  const exchange = await createOAuthExchange({ userId: user.id, provider, clientType: clientType || "unknown" });

  return Response.json({ success: true, exchangeCode: exchange.code });
}
