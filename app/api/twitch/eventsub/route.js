import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { upsertTwitchLive } from "@/lib/twitchArchive";

export const dynamic = "force-dynamic";

const MESSAGE_ID = "twitch-eventsub-message-id";
const MESSAGE_TIMESTAMP = "twitch-eventsub-message-timestamp";
const MESSAGE_SIGNATURE = "twitch-eventsub-message-signature";
const MESSAGE_TYPE = "twitch-eventsub-message-type";

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
  const payload = JSON.parse(rawBody);

  if (messageType === "webhook_callback_verification") {
    return new Response(payload.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (messageType === "revocation") {
    return NextResponse.json({ success: true, revoked: true });
  }

  if (messageType !== "notification") {
    return NextResponse.json({ success: true, ignored: true });
  }

  if (payload.subscription?.type !== "stream.online") {
    return NextResponse.json({ success: true, ignored: true });
  }

  const live = await upsertTwitchLive(payload.event || {});
  return NextResponse.json({ success: true, live });
}
