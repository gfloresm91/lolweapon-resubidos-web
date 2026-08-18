import { jsonError, readJsonRequest } from "@/lib/http";
import { logoutRefreshToken } from "@/lib/mobileAuth";

export async function POST(request) {
  const payload = await readJsonRequest(request);
  const refreshToken = payload?.refreshToken;

  if (!refreshToken) {
    return jsonError("Falta refreshToken.", { status: 400 });
  }

  await logoutRefreshToken(refreshToken);

  return Response.json({ success: true });
}
