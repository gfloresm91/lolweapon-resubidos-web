import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUserFromToken } from "@/lib/serverAuth";
import { saveAvatarUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUserFromToken(token);

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Archivo inválido." }, { status: 400 });
  }

  try {
    const savedFile = await saveAvatarUploadFile(file, user.id);
    return NextResponse.json({ success: true, path: savedFile.path });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
