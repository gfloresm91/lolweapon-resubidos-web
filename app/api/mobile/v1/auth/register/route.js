import { jsonError, readJsonRequest } from "@/lib/http";
import { getClientIp } from "@/lib/loginSecurity";
import { issueMobileSession } from "@/lib/mobileAuth";
import { registerManualUser } from "@/lib/repositories/platformUserRepository";

export async function POST(request) {
  const payload = await readJsonRequest(request);
  const clientType = payload?.clientType || "unknown";
  const deviceId = payload?.deviceId || null;

  let user;
  try {
    user = await registerManualUser(payload);
  } catch (error) {
    return jsonError(error.message || "No se pudo registrar la cuenta.", { status: 400 });
  }

  const session = await issueMobileSession(user.id, {
    clientType,
    deviceId,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") || "",
  });

  return Response.json({ success: true, user, ...session });
}
