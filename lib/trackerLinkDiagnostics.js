function cleanString(value) {
  return String(value || "").trim();
}

export function normalizeTrackerUrl(value) {
  const text = cleanString(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^telegram\.me$/, "t.me");
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${host}${pathname}${url.search}`.toLowerCase();
  } catch {
    return text.toLowerCase().replace(/\/+$/, "");
  }
}

export function buildLinkDiagnostics(lives) {
  const occurrences = new Map();
  for (const live of lives) {
    for (const platform of ["okru", "telegram"]) {
      for (const url of live.links?.[platform] || []) {
        const key = `${platform}:${normalizeTrackerUrl(url)}`;
        if (!key.endsWith(":")) occurrences.set(key, [...(occurrences.get(key) || []), live.id]);
      }
    }
  }

  return new Map(lives.map((live) => {
    const messages = [];
    if (!live.links?.okru?.length) messages.push("Sin OK.RU");
    if (!live.links?.telegram?.length) messages.push("Sin Telegram");
    for (const platform of ["okru", "telegram"]) {
      const seen = new Set();
      for (const url of live.links?.[platform] || []) {
        const normalized = normalizeTrackerUrl(url);
        const label = platform === "okru" ? "OK.RU" : "Telegram";
        if (seen.has(normalized)) messages.push(`${label} duplicado en el registro`);
        seen.add(normalized);
        const otherIds = (occurrences.get(`${platform}:${normalized}`) || []).filter((id) => id !== live.id);
        if (otherIds.length) messages.push(`${label} compartido con ${[...new Set(otherIds)].join(", ")}`);
      }
    }
    return [live.id, [...new Set(messages)]];
  }));
}

export function hasTrackerLinkIssue(live, issue, diagnostics) {
  const messages = diagnostics.get(live.id) || [];
  if (issue === "missing-okru") return !live.links?.okru?.length;
  if (issue === "missing-telegram") return !live.links?.telegram?.length;
  if (issue === "duplicate-okru") return messages.some((message) => message.startsWith("OK.RU") && (message.includes("duplicado") || message.includes("compartido")));
  if (issue === "duplicate-telegram") return messages.some((message) => message.startsWith("Telegram") && (message.includes("duplicado") || message.includes("compartido")));
  if (issue === "duplicates") return messages.some((message) => message.includes("duplicado") || message.includes("compartido"));
  return false;
}

