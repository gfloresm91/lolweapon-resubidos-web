import { jsonError } from "@/lib/http";
import { getMobileUserIdFromRequest } from "@/lib/mobileAuth";
import { getPlatformUserById } from "@/lib/repositories/platformUserRepository";

export async function GET(request) {
  const userId = await getMobileUserIdFromRequest(request);

  if (!userId) {
    return jsonError("No autenticado.", { status: 401 });
  }

  const user = await getPlatformUserById(userId);

  if (!user) {
    return jsonError("No autenticado.", { status: 401 });
  }

  return Response.json({ success: true, user });
}
