import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";
import { saveUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Archivo invalido" }, { status: 400 });
  }

  const savedFile = await saveUploadFile(file);

  return NextResponse.json({
    success: true,
    path: savedFile.path,
  });
}
