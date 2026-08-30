const globalForNotifications = globalThis;

if (!globalForNotifications.__lolweaponNotificationClients) {
  globalForNotifications.__lolweaponNotificationClients = new Set();
}

if (!globalForNotifications.__lolweaponNotificationHeartbeat) {
  globalForNotifications.__lolweaponNotificationHeartbeat = {
    states: new WeakMap(),
    timer: null,
  };
}

const clients = globalForNotifications.__lolweaponNotificationClients;
const heartbeat = globalForNotifications.__lolweaponNotificationHeartbeat;

function ensureHeartbeatTimer() {
  if (heartbeat.timer) return;

  heartbeat.timer = setInterval(() => {
    for (const client of clients) {
      if (heartbeat.states.get(client) === false) {
        clients.delete(client);
        client.terminate?.();
        continue;
      }

      heartbeat.states.set(client, false);
      try {
        client.ping();
      } catch {
        clients.delete(client);
        client.terminate?.();
      }
    }
  }, 30000);
  heartbeat.timer.unref?.();
}

function sendJson(client, payload) {
  if (client.readyState !== 1) {
    clients.delete(client);
    return;
  }

  try {
    client.send(JSON.stringify(payload));
  } catch {
    clients.delete(client);
  }
}

export function registerNotificationSocket(client) {
  ensureHeartbeatTimer();
  clients.add(client);
  heartbeat.states.set(client, true);
  sendJson(client, { type: "notifications:ready" });

  client.on("pong", () => {
    heartbeat.states.set(client, true);
  });

  client.on("close", () => {
    clients.delete(client);
  });

  client.on("error", () => {
    clients.delete(client);
  });
}

export function broadcastNotificationUpdate(payload = {}) {
  globalThis.__lolweaponPublicNotifications?.clear?.();

  const message = {
    type: "notifications:update",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  for (const client of clients) {
    sendJson(client, message);
  }
}

export function broadcastTicketUpdate(payload = {}) {
  const message = {
    type: "tickets:update",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  for (const client of clients) {
    sendJson(client, message);
  }
}

export function broadcastLiveUpdate(payload = {}) {
  const message = {
    type: "lives:update",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  for (const client of clients) {
    sendJson(client, message);
  }
}
