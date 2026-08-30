import process from "node:process";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const DEFAULT_BASE_URL = "https://resubidos-qa.lolweapon.com";
const DEFAULT_USERS = 50;
const DEFAULT_DURATION_SECONDS = 300;
const DEFAULT_RAMP_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 20_000;
const SOCKET_TIMEOUT_MS = 15_000;
const PRESENCE_HEARTBEAT_MS = 20_000;

function readNumberArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;

  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} debe ser un número mayor que cero`);
  }

  return value;
}

function readStringArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function percentile(values, percentage) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentage / 100) * sorted.length) - 1);
  return Math.round(sorted[index]);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function timedFetch(url, results) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "lolweapon-qa-load-test/1.0" },
    });
    await response.arrayBuffer();
    results.http.push({
      path: new URL(url).pathname,
      status: response.status,
      durationMs: performance.now() - startedAt,
    });
    if (!response.ok) throw new Error(`${url} respondió HTTP ${response.status}`);
  } catch (error) {
    results.errors.push(`HTTP ${url}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function openSocket(url, options, results, type) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const socket = new WebSocket(url, options);
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      results.errors.push(`${type}: timeout al conectar`);
      socket.terminate();
      resolve(null);
    }, SOCKET_TIMEOUT_MS);

    socket.once("open", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      results.sockets.push({ type, durationMs: performance.now() - startedAt });
      resolve(socket);
    });
    socket.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      results.errors.push(`${type}: ${error.message}`);
      resolve(null);
    });
  });
}

async function runVisitor({ baseUrl, durationMs, results }) {
  const origin = new URL(baseUrl).origin;
  const wsProtocol = origin.startsWith("https:") ? "wss:" : "ws:";
  const wsBase = `${wsProtocol}//${new URL(origin).host}`;
  const clientId = `load_${randomUUID().replaceAll("-", "")}`;

  await Promise.all([
    timedFetch(`${origin}/inicio`, results),
    timedFetch(`${origin}/api/notifications?limit=40&scope=public`, results),
    timedFetch(`${origin}/api/youtube/videos`, results),
  ]);

  const [notificationSocket, presenceSocket] = await Promise.all([
    openSocket(`${wsBase}/api/notifications/ws`, { headers: { Origin: origin } }, results, "notifications"),
    openSocket(`${wsBase}/api/presence/ws`, { headers: { Origin: origin } }, results, "presence"),
  ]);

  let heartbeat = null;
  if (presenceSocket) {
    const sendPresence = (type) => {
      if (presenceSocket.readyState === WebSocket.OPEN) {
        presenceSocket.send(JSON.stringify({ type, clientId, page: "home" }));
      }
    };
    sendPresence("join");
    heartbeat = setInterval(() => sendPresence("heartbeat"), PRESENCE_HEARTBEAT_MS);
  }

  await wait(durationMs);

  if (heartbeat) clearInterval(heartbeat);
  if (presenceSocket?.readyState === WebSocket.OPEN) {
    presenceSocket.send(JSON.stringify({ type: "leave", clientId, page: "home" }));
    presenceSocket.close(1000);
  }
  if (notificationSocket?.readyState === WebSocket.OPEN) notificationSocket.close(1000);
}

function summarize(results, configuredUsers, elapsedMs) {
  const successfulHttp = results.http.filter(({ status }) => status >= 200 && status < 400);
  const httpDurations = successfulHttp.map(({ durationMs }) => durationMs);
  const socketDurations = results.sockets.map(({ durationMs }) => durationMs);
  const statuses = results.http.reduce((counts, { status }) => ({
    ...counts,
    [status]: (counts[status] || 0) + 1,
  }), {});
  const sockets = results.sockets.reduce((counts, { type }) => ({
    ...counts,
    [type]: (counts[type] || 0) + 1,
  }), {});

  console.log(JSON.stringify({
    type: "public_visitor_load_test",
    configuredUsers,
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
    http: {
      completed: results.http.length,
      successful: successfulHttp.length,
      statuses,
      latencyMs: {
        p50: percentile(httpDurations, 50),
        p95: percentile(httpDurations, 95),
        p99: percentile(httpDurations, 99),
        maximum: percentile(httpDurations, 100),
      },
    },
    webSockets: {
      connected: results.sockets.length,
      byType: sockets,
      connectLatencyMs: {
        p50: percentile(socketDurations, 50),
        p95: percentile(socketDurations, 95),
        maximum: percentile(socketDurations, 100),
      },
    },
    errors: results.errors,
  }, null, 2));
}

async function main() {
  const baseUrl = readStringArg("base-url", DEFAULT_BASE_URL);
  const users = Math.floor(readNumberArg("users", DEFAULT_USERS));
  const durationSeconds = readNumberArg("duration", DEFAULT_DURATION_SECONDS);
  const rampSeconds = readNumberArg("ramp", DEFAULT_RAMP_SECONDS);
  const target = new URL(baseUrl);

  if (!target.hostname.includes("-qa.") && !process.argv.includes("--allow-non-qa")) {
    throw new Error("El destino no parece QA; usa --allow-non-qa solo con autorización explícita");
  }

  const results = { http: [], sockets: [], errors: [] };
  const startedAt = performance.now();
  const rampStepMs = users > 1 ? (rampSeconds * 1000) / (users - 1) : 0;

  console.log(`Iniciando ${users} visitantes contra ${target.origin}`);
  console.log(`Rampa: ${rampSeconds}s; permanencia por visitante: ${durationSeconds}s`);

  const visitors = Array.from({ length: users }, (_, index) => (async () => {
    if (rampStepMs) await wait(index * rampStepMs);
    await runVisitor({
      baseUrl: target.origin,
      durationMs: durationSeconds * 1000,
      results,
    });
  })());

  await Promise.all(visitors);
  summarize(results, users, performance.now() - startedAt);
  process.exitCode = results.errors.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
