import { jsonError } from "@/lib/http";
import { getMobileUserIdFromRequest } from "@/lib/mobileAuth";
import { anonymizeAndDeactivatePlatformUser } from "@/lib/repositories/platformUserRepository";

export async function POST(request) {
  const userId = await getMobileUserIdFromRequest(request);

  if (!userId) {
    return jsonError("No autenticado.", { status: 401 });
  }

  try {
    await anonymizeAndDeactivatePlatformUser(userId);
  } catch (error) {
    return jsonError(error.message || "No se pudo eliminar la cuenta.", { status: 400 });
  }

  return new Response(null, { status: 204 });
}
