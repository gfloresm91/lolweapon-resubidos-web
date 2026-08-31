#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_CONTAINER = "lolweapon-resubidos-postgres";
const COUNTERS = [
  "xactCommit",
  "xactRollback",
  "blocksRead",
  "blocksHit",
  "tempFiles",
  "tempBytes",
  "deadlocks",
];

const SQL = `
SELECT json_build_object(
  'capturedAt', clock_timestamp(),
  'postgresStartedAt', pg_postmaster_start_time(),
  'databases', COALESCE((
    SELECT json_agg(json_build_object(
      'name', stats.datname,
      'connections', stats.numbackends,
      'sizeBytes', pg_database_size(stats.datname),
      'xactCommit', stats.xact_commit,
      'xactRollback', stats.xact_rollback,
      'blocksRead', stats.blks_read,
      'blocksHit', stats.blks_hit,
      'tempFiles', stats.temp_files,
      'tempBytes', stats.temp_bytes,
      'deadlocks', stats.deadlocks,
      'statsReset', stats.stats_reset
    ) ORDER BY stats.datname)
    FROM pg_stat_database AS stats
    JOIN pg_database AS database ON database.oid = stats.datid
    WHERE database.datistemplate = false
  ), '[]'::json),
  'activity', json_build_object(
    'total', (SELECT count(*) FROM pg_stat_activity WHERE datname IS NOT NULL),
    'active', (SELECT count(*) FROM pg_stat_activity WHERE datname IS NOT NULL AND state = 'active'),
    'idle', (SELECT count(*) FROM pg_stat_activity WHERE datname IS NOT NULL AND state = 'idle'),
    'idleInTransaction', (SELECT count(*) FROM pg_stat_activity WHERE datname IS NOT NULL AND state = 'idle in transaction'),
    'waitingForLock', (SELECT count(*) FROM pg_stat_activity WHERE datname IS NOT NULL AND wait_event_type = 'Lock'),
    'activeOverOneSecond', (
      SELECT count(*) FROM pg_stat_activity
      WHERE datname IS NOT NULL
        AND state = 'active'
        AND pid <> pg_backend_pid()
      AND query_start < now() - interval '1 second'
    )
  ),
  'wal', (
    SELECT json_build_object(
      'walRecords', wal_records,
      'walFpi', wal_fpi,
      'walBytes', wal_bytes,
      'walBuffersFull', wal_buffers_full,
      'statsReset', stats_reset
    )
    FROM pg_stat_wal
  )
)::text;
`;

function parseArguments(argv) {
  const options = { container: DEFAULT_CONTAINER, stateFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--container") {
      options.container = argv[++index];
    } else if (argument === "--state-file") {
      options.stateFile = argv[++index];
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Argumento no reconocido: ${argument}`);
    }
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(options.container || "")) {
    throw new Error("Nombre de contenedor inválido");
  }
  return options;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function captureSnapshot(container) {
  const command = `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c ${shellQuote(SQL)}`;
  const { stdout } = await execFileAsync("docker", ["exec", container, "sh", "-lc", command], {
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout.trim());
}

async function loadPreviousState(path) {
  if (!path) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function saveState(path, snapshot) {
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

function round(value, decimals = 3) {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function buildDatabaseSummary(current, previous, elapsedSeconds) {
  const countersReset = !previous || COUNTERS.some(
    (counter) => Number(current[counter]) < Number(previous[counter]),
  );
  const delta = {};
  for (const counter of COUNTERS) {
    delta[counter] = countersReset ? null : Number(current[counter]) - Number(previous[counter]);
  }

  const cacheTotal = Number(current.blocksHit) + Number(current.blocksRead);
  return {
    ...current,
    cacheHitPercent: cacheTotal > 0 ? round((Number(current.blocksHit) / cacheTotal) * 100, 5) : null,
    interval: {
      baselineOnly: countersReset,
      transactionsPerSecond: countersReset
        ? null
        : round((delta.xactCommit + delta.xactRollback) / elapsedSeconds),
      blocksReadPerSecond: countersReset ? null : round(delta.blocksRead / elapsedSeconds),
      blocksHitPerSecond: countersReset ? null : round(delta.blocksHit / elapsedSeconds),
      tempFiles: delta.tempFiles,
      tempBytes: delta.tempBytes,
      deadlocks: delta.deadlocks,
    },
  };
}

function buildSummary(snapshot, previous) {
  const currentTime = new Date(snapshot.capturedAt).getTime();
  const previousTime = previous ? new Date(previous.capturedAt).getTime() : NaN;
  const elapsedSeconds = (currentTime - previousTime) / 1000;
  const validInterval = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0;
  const previousByName = new Map((previous?.databases || []).map((database) => [database.name, database]));
  const walCounters = ["walRecords", "walFpi", "walBytes", "walBuffersFull"];
  const walReset = !validInterval || !previous?.wal || walCounters.some(
    (counter) => Number(snapshot.wal[counter]) < Number(previous.wal[counter]),
  );
  const walDelta = Object.fromEntries(walCounters.map((counter) => [
    counter,
    walReset ? null : Number(snapshot.wal[counter]) - Number(previous.wal[counter]),
  ]));

  return {
    type: "postgres_observability_summary",
    capturedAt: snapshot.capturedAt,
    postgresStartedAt: snapshot.postgresStartedAt,
    intervalSeconds: validInterval ? round(elapsedSeconds) : null,
    activity: snapshot.activity,
    wal: {
      ...snapshot.wal,
      interval: {
        baselineOnly: walReset,
        records: walDelta.walRecords,
        fullPageImages: walDelta.walFpi,
        bytes: walDelta.walBytes,
        bytesPerSecond: walReset ? null : round(walDelta.walBytes / elapsedSeconds),
        buffersFull: walDelta.walBuffersFull,
      },
    },
    databases: snapshot.databases.map((database) => buildDatabaseSummary(
      database,
      validInterval ? previousByName.get(database.name) : null,
      elapsedSeconds,
    )),
  };
}

function printHelp() {
  console.log(`Uso: node summarize-postgres-observability.mjs [opciones]

Opciones:
  --container <nombre>  Contenedor PostgreSQL (por defecto: ${DEFAULT_CONTAINER})
  --state-file <ruta>   Estado anterior para calcular tasas
  -h, --help            Mostrar esta ayuda`);
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    const previous = await loadPreviousState(options.stateFile);
    const snapshot = await captureSnapshot(options.container);
    console.log(JSON.stringify(buildSummary(snapshot, previous), null, 2));
    await saveState(options.stateFile, snapshot);
  }
} catch (error) {
  console.error(`No se pudo resumir PostgreSQL: ${error.message}`);
  process.exitCode = 1;
}
