import { fetchLatestYoutubeVideos } from "../youtube.js";
import { getPrismaClient } from "../prisma.js";
import { createPlatformNotification } from "./notificationRepository.js";

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compactVideo(video = {}) {
  const id = String(video.id || "").trim();

  if (!id) {
    return null;
  }

  return {
    id,
    title: String(video.title || "Nuevo video de YouTube").trim(),
    publishedAt: parseDate(video.publishedAt),
    thumbnail: video.thumbnail ? String(video.thumbnail).trim() : null,
    url: String(video.url || `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`).trim(),
  };
}

function sortVideosByPublishDate(videos) {
  return [...videos].sort((left, right) => {
    const leftTime = left.publishedAt?.getTime?.() || 0;
    const rightTime = right.publishedAt?.getTime?.() || 0;
    return leftTime - rightTime;
  });
}

export async function syncYoutubeVideosForNotifications(videos = []) {
  const normalizedVideos = videos.map(compactVideo).filter(Boolean);

  if (!usePostgres() || !normalizedVideos.length) {
    return { created: 0, notified: 0, baseline: false };
  }

  const prisma = getPrismaClient();

  try {
    const existingCount = await prisma.youtubeVideo.count();

    if (existingCount === 0) {
      const now = new Date();
      const created = await prisma.youtubeVideo.createMany({
        data: normalizedVideos.map((video) => ({
          ...video,
          createdAt: now,
          updatedAt: now,
        })),
        skipDuplicates: true,
      });

      return { created: created.count, notified: 0, baseline: true };
    }

    let created = 0;
    let notified = 0;

    for (const video of sortVideosByPublishDate(normalizedVideos)) {
      const now = new Date();
      const savedVideo = await prisma.youtubeVideo.create({
        data: {
          ...video,
          notifiedAt: now,
        },
      }).catch((error) => {
        if (error?.code === "P2002") {
          return null;
        }

        throw error;
      });

      if (!savedVideo) {
        await prisma.youtubeVideo.update({
          where: { id: video.id },
          data: {
            title: video.title,
            publishedAt: video.publishedAt,
            thumbnail: video.thumbnail,
            url: video.url,
          },
        }).catch(() => null);
        continue;
      }

      created += 1;
      await createPlatformNotification({
        type: "alert",
        severity: "success",
        source: "youtube",
        title: "Nuevo video en YouTube",
        body: savedVideo.title,
        href: savedVideo.url,
        icon: "Video",
        audience: "all",
        metadata: {
          youtubeVideoId: savedVideo.id,
          publishedAt: savedVideo.publishedAt?.toISOString?.() || null,
        },
      });
      notified += 1;
    }

    return { created, notified, baseline: false };
  } catch (error) {
    console.error("No se pudieron sincronizar los videos de YouTube para notificaciones:", error);
    return { created: 0, notified: 0, baseline: false, error: error.message };
  }
}

export async function syncLatestYoutubeVideosForNotifications({ limit = 10 } = {}) {
  const videos = await fetchLatestYoutubeVideos(limit);
  return syncYoutubeVideosForNotifications(videos);
}
