import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";

import { syncContentNotifications } from "./lib/contentNotificationSync.js";
import { registerNotificationSocket } from "./lib/notificationRealtime.js";
import { getHomePresenceCount, registerPagePresenceSocket } from "./lib/pagePresence.js";
import { syncLatestYoutubeVideosForNotifications } from "./lib/repositories/youtubeVideoRepository.js";
import { publishDueNotifications } from "./lib/repositories/notificationRepository.js";
import { closeActiveStreamAudienceSessions, recordStreamAudienceSample } from "./lib/repositories/streamAudienceRepository.js";
import { fetchCurrentTwitchStream } from "./lib/twitch.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const DEFAULT_YOUTUBE_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const MIN_YOUTUBE_SYNC_INTERVAL_MS = 60 * 1000;
const NOTIFICATION_PUBLISH_INTERVAL_MS = 30 * 1000;
const AUDIENCE_SAMPLE_INTERVAL_MS = 60 * 1000;
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

function startScheduledNotificationPublisher() {
  let isPublishing = false;
  async function publish() {
    if (isPublishing) return;
    isPublishing = true;
    try {
      const count = await publishDueNotifications();
      if (count) console.log(`> Scheduled notifications published=${count}`);
    } catch (error) {
      console.error("> Scheduled notification publisher failed:", error);
    } finally {
      isPublishing = false;
    }
  }
  setTimeout(publish, 2000);
  setInterval(publish, NOTIFICATION_PUBLISH_INTERVAL_MS);
  console.log(`> Scheduled notification publisher every ${NOTIFICATION_PUBLISH_INTERVAL_MS / 1000}s`);
}

function startStreamAudienceSampler() {
  if (process.env.DATA_SOURCE !== "postgres" || process.env.STREAM_AUDIENCE_ANALYTICS_ENABLED === "false") {
    console.log("> Stream audience analytics disabled");
    return;
  }

  let isSampling = false;
  async function sample() {
    if (isSampling) return;
    isSampling = true;
    try {
      const stream = await fetchCurrentTwitchStream({ broadcasterLogin: process.env.TWITCH_BROADCASTER_LOGIN });
      if (stream) {
        await recordStreamAudienceSample({ stream, concurrentCount: getHomePresenceCount() });
      } else {
        await closeActiveStreamAudienceSessions();
      }
    } catch (error) {
      // A remote/API failure must not close a valid session or affect Inicio.
      console.error("> Stream audience sample failed:", error);
    } finally {
      isSampling = false;
    }
  }

  setTimeout(sample, 15_000);
  setInterval(sample, AUDIENCE_SAMPLE_INTERVAL_MS);
  console.log(`> Stream audience sample every ${AUDIENCE_SAMPLE_INTERVAL_MS / 1000}s`);
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
const presenceWss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/presence/ws") {
    const origin = request.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== request.headers.host) {
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }

    presenceWss.handleUpgrade(request, socket, head, (client) => {
      registerPagePresenceSocket(client);
    });
    return;
  }

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
  startScheduledNotificationPublisher();
  startStreamAudienceSampler();
});
