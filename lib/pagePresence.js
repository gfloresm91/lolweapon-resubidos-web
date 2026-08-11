const QUALIFICATION_MS = 15_000;
const HEARTBEAT_MS = 20_000;
const GRACE_MS = 40_000;
const CLEANUP_MS = 5_000;
const MAX_CONNECTIONS_PER_CLIENT = 8;
const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const PAGE_HOME = "home";

const globalForPresence = globalThis;

if (!globalForPresence.__lolweaponPagePresence) {
  globalForPresence.__lolweaponPagePresence = {
    records: new Map(),
    sockets: new Set(),
    socketStates: new WeakMap(),
    lastBroadcastCount: null,
    cleanupTimer: null,
  };
}

const presence = globalForPresence.__lolweaponPagePresence;

function sendJson(client, payload) {
  if (client.readyState !== 1) return false;

  try {
    client.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function getVisibleDuration(record, now) {
  return record.visibleMs + (record.activeSockets.size && record.visibleSince
    ? now - record.visibleSince
    : 0);
}

function recordIsQualified(record, now) {
  if (!record.qualified && getVisibleDuration(record, now) >= QUALIFICATION_MS) {
    record.qualified = true;
  }

  return record.qualified;
}

function recordIsPresent(record, now) {
  if (!recordIsQualified(record, now)) return false;
  if (record.activeSockets.size) return true;
  return now - record.lastSeenAt <= GRACE_MS;
}

export function getHomePresenceCount(now = Date.now()) {
  let count = 0;

  for (const record of presence.records.values()) {
    if (record.page === PAGE_HOME && recordIsPresent(record, now)) count += 1;
  }

  return count;
}

function broadcastCount({ force = false } = {}) {
  const count = getHomePresenceCount();
  if (!force && count === presence.lastBroadcastCount) return;

  presence.lastBroadcastCount = count;
  const payload = {
    type: "presence:update",
    page: PAGE_HOME,
    count,
    timestamp: new Date().toISOString(),
  };

  for (const client of presence.sockets) {
    if (!sendJson(client, payload)) presence.sockets.delete(client);
  }
}

function pauseRecord(record, now) {
  if (!record.activeSockets.size && record.visibleSince) {
    record.visibleMs += now - record.visibleSince;
    record.visibleSince = null;
  }
  record.lastSeenAt = now;
}

function detachSocket(client) {
  const state = presence.socketStates.get(client);
  if (!state?.clientId) return;

  const record = presence.records.get(state.clientId);
  if (record) {
    record.sockets.delete(client);
    record.activeSockets.delete(client);
    pauseRecord(record, Date.now());
  }

  state.clientId = null;
  state.active = false;
  broadcastCount();
}

function joinHome(client, clientId) {
  if (!CLIENT_ID_PATTERN.test(clientId)) return;

  const state = presence.socketStates.get(client);
  if (!state) return;
  if (state.clientId && state.clientId !== clientId) detachSocket(client);

  const now = Date.now();
  let record = presence.records.get(clientId);

  if (!record) {
    record = {
      page: PAGE_HOME,
      sockets: new Set(),
      activeSockets: new Set(),
      visibleMs: 0,
      visibleSince: now,
      lastSeenAt: now,
      qualified: false,
    };
    presence.records.set(clientId, record);
  }

  if (!record.sockets.has(client) && record.sockets.size >= MAX_CONNECTIONS_PER_CLIENT) {
    client.close(1008, "Too many presence connections");
    return;
  }

  record.sockets.add(client);
  if (!record.activeSockets.size) record.visibleSince = now;
  record.activeSockets.add(client);
  record.lastSeenAt = now;
  state.clientId = clientId;
  state.active = true;
  sendJson(client, {
    type: "presence:joined",
    page: PAGE_HOME,
    qualificationMs: QUALIFICATION_MS,
    heartbeatMs: HEARTBEAT_MS,
    graceMs: GRACE_MS,
  });
  broadcastCount({ force: true });
}

function leaveHome(client) {
  const state = presence.socketStates.get(client);
  if (!state?.clientId || !state.active) return;

  const record = presence.records.get(state.clientId);
  if (record) {
    record.activeSockets.delete(client);
    pauseRecord(record, Date.now());
  }
  state.active = false;
  broadcastCount();
}

function heartbeat(client, clientId) {
  const state = presence.socketStates.get(client);
  if (!state?.active || state.clientId !== clientId) return;

  const record = presence.records.get(clientId);
  if (!record?.activeSockets.has(client)) return;
  record.lastSeenAt = Date.now();
}

function handleMessage(client, rawMessage) {
  const state = presence.socketStates.get(client);
  const now = Date.now();
  if (!state) return;

  let payload;
  try {
    payload = JSON.parse(String(rawMessage));
  } catch {
    return;
  }

  const clientId = String(payload?.clientId || "").trim();
  if (!CLIENT_ID_PATTERN.test(clientId) || payload?.page !== PAGE_HOME) return;

  // A visibility-driven leave must never be discarded just because it follows
  // a join immediately; only repetitive positive-presence messages are limited.
  if (payload.type !== "leave" && now - state.lastMessageAt < 400) return;
  if (payload.type !== "leave") state.lastMessageAt = now;

  if (payload.type === "join") joinHome(client, clientId);
  else if (payload.type === "heartbeat") heartbeat(client, clientId);
  else if (payload.type === "leave") leaveHome(client);
}

function cleanupPresence() {
  const now = Date.now();

  for (const [clientId, record] of presence.records) {
    for (const socket of record.activeSockets) {
      if (now - record.lastSeenAt > GRACE_MS) {
        record.activeSockets.delete(socket);
        const state = presence.socketStates.get(socket);
        if (state) state.active = false;
      }
    }

    pauseRecord(record, now);
    if (!record.activeSockets.size && now - record.lastSeenAt > GRACE_MS) {
      presence.records.delete(clientId);
    }
  }

  broadcastCount();
}

function ensureCleanupTimer() {
  if (presence.cleanupTimer) return;
  presence.cleanupTimer = setInterval(cleanupPresence, CLEANUP_MS);
  presence.cleanupTimer.unref?.();
}

export function registerPagePresenceSocket(client) {
  ensureCleanupTimer();
  presence.sockets.add(client);
  presence.socketStates.set(client, { clientId: null, active: false, lastMessageAt: 0 });
  sendJson(client, {
    type: "presence:ready",
    page: PAGE_HOME,
    count: getHomePresenceCount(),
  });

  client.on("message", (message) => handleMessage(client, message));
  client.on("close", () => {
    detachSocket(client);
    presence.sockets.delete(client);
  });
  client.on("error", () => {
    detachSocket(client);
    presence.sockets.delete(client);
  });
}
