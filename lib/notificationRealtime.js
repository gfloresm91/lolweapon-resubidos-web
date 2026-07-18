const globalForNotifications = globalThis;

if (!globalForNotifications.__lolweaponNotificationClients) {
  globalForNotifications.__lolweaponNotificationClients = new Set();
}

const clients = globalForNotifications.__lolweaponNotificationClients;

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
  clients.add(client);
  sendJson(client, { type: "notifications:ready" });

  client.on("close", () => {
    clients.delete(client);
  });

  client.on("error", () => {
    clients.delete(client);
  });
}

export function broadcastNotificationUpdate(payload = {}) {
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
