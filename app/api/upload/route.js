import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";

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

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const uploadDir = path.join(process.cwd(), "public", "imagenes");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, safeName), buffer);

  return NextResponse.json({
    success: true,
    path: `/imagenes/${safeName}`,
  });
}

