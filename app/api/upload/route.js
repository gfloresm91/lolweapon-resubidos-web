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
    "anime.tierlist.openings.manage",
    "admin.anime.tierlist.animes.create",
    "admin.anime.tierlist.openings.create",
  ]);

  if (authorization.response) {
    return authorization.response;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Archivo invalido" }, { status: 400 });
  }

  try {
    const savedFile = await saveUploadFile(file);

    return NextResponse.json({
      success: true,
      path: savedFile.path,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "No se pudo subir la imagen." },
      { status: 400 },
    );
  }
}
