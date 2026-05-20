const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

function getApiKey() {
  return process.env.YOUTUBE_API_KEY || "";
}

async function youtubeFetch(path, params) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return null;
  }

  const searchParams = new URLSearchParams({
    ...params,
    key: apiKey,
  });
  const response = await fetch(`${YOUTUBE_API_URL}${path}?${searchParams.toString()}`, {
    next: { revalidate: 900 },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "No se pudieron obtener videos de YouTube");
  }

  return data;
}

async function resolveUploadsPlaylistId() {
  if (process.env.YOUTUBE_UPLOADS_PLAYLIST_ID) {
    return process.env.YOUTUBE_UPLOADS_PLAYLIST_ID;
  }

  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!channelId) {
    return "";
  }

  const data = await youtubeFetch("/channels", {
    part: "contentDetails",
    id: channelId,
  });

  return data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || "";
}

export async function fetchLatestYoutubeVideos(limit = 10) {
  const playlistId = await resolveUploadsPlaylistId();

  if (!playlistId) {
    return [];
  }

  const data = await youtubeFetch("/playlistItems", {
    part: "snippet,contentDetails",
    playlistId,
    maxResults: String(limit),
  });

  return (data?.items || [])
    .map((item) => {
      const snippet = item.snippet || {};
      const videoId = item.contentDetails?.videoId || snippet.resourceId?.videoId;

      if (!videoId) {
        return null;
      }

      return {
        id: videoId,
        title: snippet.title || "Video sin título",
        publishedAt: snippet.publishedAt || "",
        thumbnail:
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter(Boolean);
}

