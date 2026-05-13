import { NextResponse } from "next/server";

import { getUploadContentType, readAvatarUploadFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { filename } = await params;

  try {
    const file = await readAvatarUploadFile(filename);

    return new NextResponse(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": getUploadContentType(filename),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Avatar no encontrado" },
      { status: 404 },
    );
  }
}
