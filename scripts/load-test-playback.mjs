import { readFile } from "node:fs/promises";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function percentile(values, percentage) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentage / 100) - 1)]);
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const file = arg("sessions-file");
  if (!file) throw new Error("Falta --sessions-file");
  const fixture = JSON.parse(await readFile(file, "utf8"));
  if (fixture?.type !== "playback_load_fixture") throw new Error("Fixture inválido");
  const target = new URL(fixture.baseUrl);
  if (!target.hostname.includes("-qa.")) throw new Error("El fixture no apunta a QA");

  const users = Number(arg("users", fixture.sessions.length));
  const durationSeconds = Number(arg("duration", 300));
  const rampSeconds = Number(arg("ramp", 60));
  const intervalSeconds = 12;
  if (!Number.isInteger(users) || users < 1 || users > fixture.sessions.length) throw new Error("Cantidad de usuarios inválida");

  const results = [];
  const errors = [];
  const startedAt = performance.now();
  const rampStepMs = users > 1 ? rampSeconds * 1000 / (users - 1) : 0;
  const ticks = Math.floor(durationSeconds / intervalSeconds);

  console.log(`Iniciando ${users} reproducciones QA; ${ticks} guardados por usuario cada ${intervalSeconds}s`);
  await Promise.all(fixture.sessions.slice(0, users).map((session, index) => (async () => {
    if (rampStepMs) await wait(index * rampStepMs);
    for (let tick = 1; tick <= ticks; tick += 1) {
      await wait(intervalSeconds * 1000);
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(`${target.origin}/api/lives/${fixture.liveId}/playback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `${fixture.cookieName}=${session.token}`,
            "User-Agent": "lolweapon-qa-playback-load-test/1.0",
          },
          body: JSON.stringify({
            source: "piero",
            partIndex: 0,
            positionSeconds: tick * intervalSeconds,
            durationSeconds: 7200,
            completed: false,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        await response.arrayBuffer();
        results.push({ status: response.status, durationMs: performance.now() - requestStartedAt });
        if (!response.ok) errors.push(`usuario ${index + 1}, tick ${tick}: HTTP ${response.status}`);
      } catch (error) {
        errors.push(`usuario ${index + 1}, tick ${tick}: ${error.message}`);
      }
    }
  })()));

  const successful = results.filter(({ status }) => status >= 200 && status < 300);
  const latencies = successful.map(({ durationMs }) => durationMs);
  const statuses = results.reduce((counts, { status }) => ({ ...counts, [status]: (counts[status] || 0) + 1 }), {});
  console.log(JSON.stringify({
    type: "playback_load_test",
    configuredUsers: users,
    intervalSeconds,
    elapsedSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(2)),
    requests: results.length,
    successful: successful.length,
    requestsPerSecond: Number((successful.length / ((performance.now() - startedAt) / 1000)).toFixed(3)),
    statuses,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      maximum: percentile(latencies, 100),
    },
    errors,
  }, null, 2));
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
