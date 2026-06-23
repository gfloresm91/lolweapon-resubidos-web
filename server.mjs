import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";

import { syncContentNotifications } from "./lib/contentNotificationSync.js";
import { registerNotificationSocket } from "./lib/notificationRealtime.js";
import { syncLatestYoutubeVideosForNotifications } from "./lib/repositories/youtubeVideoRepository.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const DEFAULT_YOUTUBE_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const MIN_YOUTUBE_SYNC_INTERVAL_MS = 60 * 1000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function getYoutubeSyncIntervalMs() {
  const interval = Number(process.env.YOUTUBE_NOTIFICATION_SYNC_INTERVAL_MS || DEFAULT_YOUTUBE_SYNC_INTERVAL_MS);

  if (!Number.isFinite(interval) || interval <= 0) {
    return DEFAULT_YOUTUBE_SYNC_INTERVAL_MS;
  }

  return Math.max(interval, MIN_YOUTUBE_SYNC_INTERVAL_MS);
}

function youtubeNotificationSyncIsEnabled() {
  return process.env.YOUTUBE_NOTIFICATION_SYNC_ENABLED !== "false";
}

function startYoutubeNotificationSync() {
  if (!youtubeNotificationSyncIsEnabled()) {
    console.log("> YouTube notification sync disabled");
    return;
  }

  const intervalMs = getYoutubeSyncIntervalMs();
  let isSyncing = false;

  async function runSync() {
    if (isSyncing) {
      return;
    }

    isSyncing = true;

    try {
      const result = await syncLatestYoutubeVideosForNotifications({ limit: 10 });

      if (result?.notified || result?.baseline) {
        console.log(
          `> YouTube notification sync: created=${result.created} notified=${result.notified} baseline=${result.baseline}`,
        );
      }
    } catch (error) {
      console.error("> YouTube notification sync failed:", error);
    } finally {
      isSyncing = false;
    }
  }

  setTimeout(runSync, 5000);
  setInterval(runSync, intervalMs);
  console.log(`> YouTube notification sync every ${Math.round(intervalMs / 1000)}s`);
}

async function syncStartupNotifications() {
  try {
    const result = await syncContentNotifications();
    console.log(`> Content notification sync: synced=${result.synced}/${result.total}`);
  } catch (error) {
    console.error("> Content notification sync failed:", error);
  }
}

await app.prepare();

const handleUpgrade = app.getUpgradeHandler();
const server = createServer((request, response) => {
  handle(request, response);
});
const notificationWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname !== "/api/notifications/ws") {
    handleUpgrade(request, socket, head);
    return;
  }

  notificationWss.handleUpgrade(request, socket, head, (client) => {
    registerNotificationSocket(client);
  });
});

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
  void syncStartupNotifications();
  startYoutubeNotificationSync();
});
