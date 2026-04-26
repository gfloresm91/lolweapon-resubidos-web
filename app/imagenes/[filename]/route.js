import { NextResponse } from "next/server";

import { getUploadContentType, readUploadFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { filename } = await params;

  try {
    const file = await readUploadFile(filename);

    return new NextResponse(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": getUploadContentType(filename),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Imagen no encontrada" },
      { status: 404 },
    );
  }
}
