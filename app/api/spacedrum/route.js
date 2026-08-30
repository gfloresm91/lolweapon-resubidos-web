import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import {
  getSpaceDrumProgressForUser,
  readSpaceDrumLibrary,
} from "@/lib/repositories/spaceDrumRepository";
import { can } from "@/lib/repositories/platformUserRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const currentUser = await getCurrentUserFromToken(token);

  if (!can(currentUser, "spacedrum.view")) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const [spacedrum, progress] = await Promise.all([
    readSpaceDrumLibrary(),
    currentUser?.id ? getSpaceDrumProgressForUser(currentUser.id) : {},
  ]);

  return NextResponse.json({ success: true, spacedrum, progress });
}
