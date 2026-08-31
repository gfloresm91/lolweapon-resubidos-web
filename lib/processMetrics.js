import { monitorEventLoopDelay, performance } from "node:perf_hooks";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 15_000;
const BYTES_PER_MIB = 1024 * 1024;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function bytesToMib(value) {
  return round(value / BYTES_PER_MIB);
}

function nanosecondsToMilliseconds(value) {
  return Number.isFinite(value) ? round(value / NANOSECONDS_PER_MILLISECOND, 2) : null;
}

function getIntervalMs() {
  const configured = Number(process.env.PROCESS_METRICS_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.max(configured, MIN_INTERVAL_MS)
    : DEFAULT_INTERVAL_MS;
}

function metricsAreEnabled() {
  if (process.env.PROCESS_METRICS_ENABLED === "true") return true;
  if (process.env.PROCESS_METRICS_ENABLED === "false") return false;
  return process.env.NODE_ENV === "production";
}

function getHttpConnectionCount(server) {
  return new Promise((resolve) => {
    server.getConnections((error, count) => resolve(error ? null : count));
  });
}

export function startProcessMetrics({
  server,
  getNotificationSocketCount = () => 0,
  getPresenceSocketCount = () => 0,
  getPresenceUserCount = () => 0,
} = {}) {
  if (!server || !metricsAreEnabled()) {
    return () => {};
  }

  const intervalMs = getIntervalMs();
  const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  let previousCpuUsage = process.cpuUsage();
  let previousSampleTime = process.hrtime.bigint();
  let previousEventLoopUtilization = performance.eventLoopUtilization();
  let isCollecting = false;

  eventLoopDelay.enable();

  async function collect() {
    if (isCollecting) return;
    isCollecting = true;

    try {
      const now = process.hrtime.bigint();
      const elapsedMicroseconds = Number(now - previousSampleTime) / 1000;
      const cpuUsage = process.cpuUsage(previousCpuUsage);
      const cpuMicroseconds = cpuUsage.user + cpuUsage.system;
      const eventLoopUtilization = performance.eventLoopUtilization(previousEventLoopUtilization);
      const memory = process.memoryUsage();
      const httpConnections = await getHttpConnectionCount(server);
      const metrics = {
        type: "process_metrics",
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
        intervalMs,
        cpuPercentOneCore: elapsedMicroseconds > 0 ? round((cpuMicroseconds / elapsedMicroseconds) * 100, 2) : null,
        memoryMib: {
          rss: bytesToMib(memory.rss),
          heapUsed: bytesToMib(memory.heapUsed),
          heapTotal: bytesToMib(memory.heapTotal),
          external: bytesToMib(memory.external),
        },
        eventLoop: {
          utilizationPercent: round(eventLoopUtilization.utilization * 100, 2),
          delayMeanMs: nanosecondsToMilliseconds(eventLoopDelay.mean),
          delayP50Ms: nanosecondsToMilliseconds(eventLoopDelay.percentile(50)),
          delayP95Ms: nanosecondsToMilliseconds(eventLoopDelay.percentile(95)),
          delayP99Ms: nanosecondsToMilliseconds(eventLoopDelay.percentile(99)),
          delayMaxMs: nanosecondsToMilliseconds(eventLoopDelay.max),
        },
        connections: {
          http: httpConnections,
          notificationWebSocket: getNotificationSocketCount(),
          presenceWebSocket: getPresenceSocketCount(),
          presenceUsers: getPresenceUserCount(),
        },
      };

      console.log(`> Process metrics ${JSON.stringify(metrics)}`);
      previousCpuUsage = process.cpuUsage();
      previousSampleTime = process.hrtime.bigint();
      previousEventLoopUtilization = performance.eventLoopUtilization();
      eventLoopDelay.reset();
    } catch (error) {
      console.error("> Process metrics collection failed:", error);
    } finally {
      isCollecting = false;
    }
  }

  const timer = setInterval(collect, intervalMs);
  timer.unref?.();
  console.log(`> Process metrics every ${Math.round(intervalMs / 1000)}s`);

  return () => {
    clearInterval(timer);
    eventLoopDelay.disable();
  };
}
