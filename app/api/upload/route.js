import { NextResponse } from "next/server";

import { ensureAnyPermissionAuthorized } from "@/lib/serverAuth";
import { saveUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request) {
  const authorization = await ensureAnyPermissionAuthorized(request, [
    "tracker.create",
    "tracker.update",
    "anime.tracking.create",
    "anime.tracking.update",
    "anime.completed.create",
    "anime.completed.update",
  ]);

  if (authorization.response) {
    return authorization.response;
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
