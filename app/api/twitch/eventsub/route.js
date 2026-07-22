import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createPlatformNotificationOnce } from "@/lib/repositories/notificationRepository";
import { upsertTwitchLive } from "@/lib/twitchArchive";

export const dynamic = "force-dynamic";

const MESSAGE_ID = "twitch-eventsub-message-id";
const MESSAGE_TIMESTAMP = "twitch-eventsub-message-timestamp";
const MESSAGE_SIGNATURE = "twitch-eventsub-message-signature";
const MESSAGE_TYPE = "twitch-eventsub-message-type";
const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;

function getEventSubSecret() {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;

  if (!secret) {
    throw new Error("Falta configurar TWITCH_EVENTSUB_SECRET");
  }

  return secret;
}

function verifyTwitchSignature(headers, rawBody) {
  const messageId = headers.get(MESSAGE_ID);
  const timestamp = headers.get(MESSAGE_TIMESTAMP);
  const signature = headers.get(MESSAGE_SIGNATURE);

  if (!messageId || !timestamp || !signature) {
    return false;
  }

  const messageTime = Date.parse(timestamp);

  if (!Number.isFinite(messageTime) || Math.abs(Date.now() - messageTime) > MAX_MESSAGE_AGE_MS) {
    return false;
  }

  const hmacMessage = `${messageId}${timestamp}${rawBody}`;
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", getEventSubSecret())
    .update(hmacMessage)
    .digest("hex")}`;

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

export async function POST(request) {
  const rawBody = await request.text();

  if (!verifyTwitchSignature(request.headers, rawBody)) {
    return NextResponse.json({ success: false, error: "Firma invalida" }, { status: 403 });
  }

  const messageType = request.headers.get(MESSAGE_TYPE);
  let payload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Payload invalido" }, { status: 400 });
  }

  if (messageType === "webhook_callback_verification") {
    return new Response(payload.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (messageType === "revocation") {
    console.warn(
      `> Twitch EventSub revoked: type=${payload.subscription?.type || "unknown"}`,
      `status=${payload.subscription?.status || "unknown"}`,
      `id=${payload.subscription?.id || "unknown"}`,
    );
    return NextResponse.json({ success: true, revoked: true });
  }

  if (messageType !== "notification") {
    return NextResponse.json({ success: true, ignored: true });
  }

  if (payload.subscription?.type !== "stream.online") {
    return NextResponse.json({ success: true, ignored: true });
  }

  const event = payload.event || {};
  const live = await upsertTwitchLive(event, { trustedOnlineEvent: true });
  if (live) {
    await createPlatformNotificationOnce({
      dedupeKey: `twitch:stream-online:${event.id || live.id}`,
      type: "alert",
      severity: "success",
      source: "twitch",
      title: "Lolweapon está en directo",
      body: live.title || "Se detectó un nuevo directo desde Twitch.",
      href: "/inicio",
      icon: "Radio",
      audience: "all",
      metadata: { liveId: live.id, twitchEventId: event.id || null },
    });
  }
  return NextResponse.json({ success: true, live });
}
