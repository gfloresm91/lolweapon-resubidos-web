#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const DEFAULT_LOG_PATH = "/var/log/nginx/observability.log";
const DEFAULT_WINDOW_MINUTES = 15;
const CRITICAL_STATUSES = new Set([499, 502, 503, 504]);

function parseArguments(argv) {
  const options = {
    file: DEFAULT_LOG_PATH,
    minutes: DEFAULT_WINDOW_MINUTES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--file") {
      options.file = argv[index + 1];
      index += 1;
    } else if (argument === "--minutes") {
      options.minutes = Number(argv[index + 1]);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Argumento no reconocido: ${argument}`);
    }
  }

  if (!options.file) {
    throw new Error("--file requiere una ruta");
  }

  if (!Number.isFinite(options.minutes) || options.minutes <= 0) {
    throw new Error("--minutes debe ser un número mayor que cero");
  }

  return options;
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function createHostSummary(host) {
  return {
    host,
    entries: 0,
    httpRequests: 0,
    upgradesClosed: 0,
    statusCounts: {},
    httpRequestTimesMs: [],
    httpUpstreamTimesMs: [],
    criticalErrors: [],
    clientErrorCounts: new Map(),
    trackedRoutes: new Map(),
  };
}

function normalizeTrackedRoute(path) {
  if (/^\/api\/lives\/\d+\/playback$/.test(path || "")) {
    return "/api/lives/:id/playback";
  }
  if (/^\/api\/mobile\/v1\/lives\/\d+\/playback$/.test(path || "")) {
    return "/api/mobile/v1/lives/:id/playback";
  }
  return null;
}

function addTrackedRoute(summary, entry, requestTimeMs) {
  const route = normalizeTrackedRoute(entry.path);
  if (!route) return;
  const key = `${entry.method || "UNKNOWN"} ${route}`;
  const tracked = summary.trackedRoutes.get(key) || {
    method: entry.method || "UNKNOWN",
    route,
    requestTimesMs: [],
    statusCounts: {},
  };
  tracked.requestTimesMs.push(requestTimeMs);
  tracked.statusCounts[entry.status] = (tracked.statusCounts[entry.status] || 0) + 1;
  summary.trackedRoutes.set(key, tracked);
}

function numericUpstreamTime(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const candidates = value
    .split(/[,:]/)
    .map((part) => Number(part.trim()))
    .filter(Number.isFinite);

  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

function finalizeHost(summary, windowSeconds) {
  const average = (values) => (
    values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null
  );

  return {
    host: summary.host,
    entries: summary.entries,
    entriesPerSecond: round(summary.entries / windowSeconds, 3),
    httpRequests: summary.httpRequests,
    upgradesClosed: summary.upgradesClosed,
    statusCounts: summary.statusCounts,
    httpLatencyMs: {
      average: round(average(summary.httpRequestTimesMs)),
      p50: round(percentile(summary.httpRequestTimesMs, 50)),
      p95: round(percentile(summary.httpRequestTimesMs, 95)),
      p99: round(percentile(summary.httpRequestTimesMs, 99)),
      maximum: round(Math.max(...summary.httpRequestTimesMs)),
    },
    upstreamLatencyMs: {
      average: round(average(summary.httpUpstreamTimesMs)),
      p95: round(percentile(summary.httpUpstreamTimesMs, 95)),
      maximum: round(Math.max(...summary.httpUpstreamTimesMs)),
    },
    criticalErrors: summary.criticalErrors,
    topClientErrors: [...summary.clientErrorCounts.entries()]
      .map(([key, count]) => {
        const [status, path] = key.split("\u0000");
        return { status: Number(status), path, count };
      })
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
    trackedRoutes: [...summary.trackedRoutes.values()].map((route) => ({
      method: route.method,
      route: route.route,
      requests: route.requestTimesMs.length,
      requestsPerSecond: round(route.requestTimesMs.length / windowSeconds, 4),
      statusCounts: route.statusCounts,
      latencyMs: {
        average: round(average(route.requestTimesMs)),
        p95: round(percentile(route.requestTimesMs, 95)),
        p99: round(percentile(route.requestTimesMs, 99)),
        maximum: round(Math.max(...route.requestTimesMs)),
      },
    })),
  };
}

async function summarize({ file, minutes }) {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - minutes * 60 * 1000);
  const hosts = new Map();
  let malformedLines = 0;
  let linesOutsideWindow = 0;

  const input = createReadStream(file, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }

    const timestamp = new Date(entry.timestamp);
    if (!Number.isFinite(timestamp.getTime()) || timestamp < windowStart || timestamp > windowEnd) {
      linesOutsideWindow += 1;
      continue;
    }

    const host = entry.host || "unknown";
    const summary = hosts.get(host) || createHostSummary(host);
    hosts.set(host, summary);
    summary.entries += 1;

    const status = Number(entry.status);
    if (Number.isFinite(status)) {
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
    }

    const isUpgrade = entry.connectionType === "upgrade" || status === 101;
    if (isUpgrade) {
      summary.upgradesClosed += 1;
      continue;
    }

    summary.httpRequests += 1;
    const requestTime = Number(entry.requestTime);
    if (Number.isFinite(requestTime)) summary.httpRequestTimesMs.push(requestTime * 1000);
    if (Number.isFinite(requestTime)) addTrackedRoute(summary, entry, requestTime * 1000);

    const upstreamTime = numericUpstreamTime(entry.upstreamResponseTime);
    if (upstreamTime !== null) summary.httpUpstreamTimesMs.push(upstreamTime * 1000);

    if (status >= 400 && status < 500) {
      const key = `${status}\u0000${entry.path || "unknown"}`;
      summary.clientErrorCounts.set(key, (summary.clientErrorCounts.get(key) || 0) + 1);
    }

    if (CRITICAL_STATUSES.has(status)) {
      summary.criticalErrors.push({
        timestamp: entry.timestamp,
        status,
        method: entry.method,
        path: entry.path,
        requestTimeMs: round(requestTime * 1000),
      });
    }
  }

  const windowSeconds = minutes * 60;
  return {
    type: "nginx_observability_summary",
    generatedAt: windowEnd.toISOString(),
    window: {
      minutes,
      from: windowStart.toISOString(),
      to: windowEnd.toISOString(),
    },
    totals: {
      entries: [...hosts.values()].reduce((total, host) => total + host.entries, 0),
      malformedLines,
      linesOutsideWindow,
    },
    hosts: [...hosts.values()]
      .map((host) => finalizeHost(host, windowSeconds))
      .sort((left, right) => left.host.localeCompare(right.host)),
  };
}

function printHelp() {
  console.log(`Uso: node scripts/summarize-nginx-observability.mjs [opciones]

Opciones:
  --file <ruta>       Log JSON de Nginx (por defecto: ${DEFAULT_LOG_PATH})
  --minutes <número>  Ventana retrospectiva (por defecto: ${DEFAULT_WINDOW_MINUTES})
  -h, --help          Mostrar esta ayuda`);
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    console.log(JSON.stringify(await summarize(options), null, 2));
  }
} catch (error) {
  console.error(`No se pudo resumir el log de Nginx: ${error.message}`);
  process.exitCode = 1;
}
