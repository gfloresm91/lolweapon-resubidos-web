import { broadcastLiveUpdate } from "./notificationRealtime.js";

const globalForLiveCatalog = globalThis;

if (!globalForLiveCatalog.__lolweaponLiveCatalogCache) {
  globalForLiveCatalog.__lolweaponLiveCatalogCache = {
    value: null,
    loadedAt: 0,
    promise: null,
    revision: 0,
  };
}

export const liveCatalogCache = globalForLiveCatalog.__lolweaponLiveCatalogCache;

export function cacheLiveCatalog(lives, { action = null, liveId = null, broadcast = false } = {}) {
  liveCatalogCache.revision += 1;
  liveCatalogCache.value = lives;
  liveCatalogCache.loadedAt = Date.now();
  liveCatalogCache.promise = null;

  if (broadcast) {
    broadcastLiveUpdate({ action, liveId, revision: liveCatalogCache.revision });
  }

  return lives;
}

export function invalidateLiveCatalog({ action = "invalidated", liveId = null, broadcast = true } = {}) {
  liveCatalogCache.revision += 1;
  liveCatalogCache.value = null;
  liveCatalogCache.loadedAt = 0;
  liveCatalogCache.promise = null;

  if (broadcast) {
    broadcastLiveUpdate({ action, liveId, revision: liveCatalogCache.revision });
  }
}
