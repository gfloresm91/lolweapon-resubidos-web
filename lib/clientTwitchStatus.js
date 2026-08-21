"use client";

const DEFAULT_MAX_AGE_MS = 55_000;

let cachedStatus = null;
let statusPromise = null;

export async function getClientTwitchStatus({ maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  const now = Date.now();

  if (cachedStatus && now - cachedStatus.updatedAt <= maxAgeMs) {
    return cachedStatus.data;
  }

  if (!statusPromise) {
    statusPromise = fetch("/api/twitch/status", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "No se pudo consultar el estado de Twitch.");
        }

        cachedStatus = { data, updatedAt: Date.now() };
        return data;
      })
      .finally(() => {
        statusPromise = null;
      });
  }

  return statusPromise;
}
