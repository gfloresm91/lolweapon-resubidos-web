import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { readJsonRequest } from "@/lib/http";
import {
  getSpaceDrumProgressForUser,
  updateSpaceDrumProgressForUser,
} from "@/lib/repositories/spaceDrumRepository";
import { getCurrentUserFromToken } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return getCurrentUserFromToken(token);
}

export async function GET(request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const progress = await getSpaceDrumProgressForUser(user.id);
  return NextResponse.json({ success: true, progress });
}

export async function POST(request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    const progress = await updateSpaceDrumProgressForUser(user.id, payload);
    return NextResponse.json({ success: true, progress });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo guardar el progreso." },
      { status: 400 },
    );
  }
}
