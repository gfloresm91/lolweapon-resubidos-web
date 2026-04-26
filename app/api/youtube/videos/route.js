import { NextResponse } from "next/server";

import { fetchLatestYoutubeVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const videos = await fetchLatestYoutubeVideos(10);
    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json(
      { videos: [], error: error.message },
      { status: 200 },
    );
  }
}

