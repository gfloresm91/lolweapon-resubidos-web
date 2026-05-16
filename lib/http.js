import { NextResponse } from "next/server";

export async function readJsonRequest(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function jsonError(error, { status = 400 } = {}) {
  return NextResponse.json({ success: false, error }, { status });
}

export function jsonUnsupportedAction() {
  return jsonError("Acción no soportada", { status: 400 });
}
