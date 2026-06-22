import { NextResponse } from "next/server";

import { syncYoutubeVideosForNotifications } from "@/lib/repositories/youtubeVideoRepository";
import { fetchLatestYoutubeVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const videos = await fetchLatestYoutubeVideos(10);
    await syncYoutubeVideosForNotifications(videos);

    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json(
      { videos: [], error: error.message },
      { status: 200 },
    );
  }
}
