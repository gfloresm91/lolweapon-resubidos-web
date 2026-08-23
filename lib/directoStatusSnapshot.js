import { writeFile, rename } from "node:fs/promises";
import path from "node:path";

import { getCachedTwitchStatus } from "./twitchStatus.js";

function cleanText(value) {
  return typeof value === "string" ? value : "";
}

function cleanNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function publicSnapshot(status) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    isOnline: Boolean(status?.isOnline),
    twitchLogin: cleanText(status?.twitchLogin),
    title: cleanText(status?.stream?.title || status?.channelInfo?.title),
    category: cleanText(status?.stream?.game_name || status?.channelInfo?.game_name),
    viewerCount: cleanNumber(status?.stream?.viewer_count),
    displayName: cleanText(status?.profile?.display_name || status?.profile?.login),
    description: cleanText(status?.profile?.description),
    profileImageUrl: cleanText(status?.profile?.profile_image_url),
    categoryImageUrl: cleanText(status?.game?.box_art_url)
      .replace("{width}", "96")
      .replace("{height}", "128"),
  };
}

export async function writeDirectoStatusSnapshot(directory) {
  if (!directory) return null;

  const { status, cacheStatus, error } = await getCachedTwitchStatus();
  if (error && cacheStatus === "error") throw error;

  const outputPath = path.join(directory, "directo-status.json");
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  const snapshot = publicSnapshot(status);
  await writeFile(temporaryPath, `${JSON.stringify(snapshot)}\n`, { mode: 0o644 });
  await rename(temporaryPath, outputPath);
  return { outputPath, cacheStatus, snapshot };
}
