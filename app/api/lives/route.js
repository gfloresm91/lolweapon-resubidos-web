import { NextResponse } from "next/server";

import { readLives } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const lives = await readLives();
  return NextResponse.json({ lives });
}

