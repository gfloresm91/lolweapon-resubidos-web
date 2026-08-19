import { jsonError, readJsonRequest } from "@/lib/http";
import { getMobileUserIdFromRequest } from "@/lib/mobileAuth";
import { registerPushToken } from "@/lib/mobilePush";

// Auth opcional a propósito: un dispositivo invitado (sin Authorization) también se registra, solo
// que sin userId - sigue recibiendo audience "all". getMobileUserIdFromRequest nunca lanza, un null
// no es un error acá.
export async function POST(request) {
  const payload = await readJsonRequest(request);
  const token = payload?.token;

  if (!token) {
    return jsonError("Falta token.", { status: 400 });
  }

  const userId = await getMobileUserIdFromRequest(request);
  const clientType = payload?.clientType || "unknown";
  const deviceId = payload?.deviceId || null;

  await registerPushToken({ token, userId, clientType, deviceId });

  return Response.json({ success: true });
}
