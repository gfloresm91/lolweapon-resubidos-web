import { getPrismaClient } from "../prisma.js";

const DEFAULT_HISTORY_LIMIT = 10;
const MAX_HISTORY_LIMIT = 50;

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function minuteBucket(value = new Date()) {
  const date = new Date(value);
  date.setUTCSeconds(0, 0);
  return date;
}

function serializeSession(session, { includeSamples = false } = {}) {
  if (!session) return null;
  return {
    id: session.id,
    liveId: session.liveId,
    twitchStreamId: session.twitchStreamId,
    twitchLogin: session.twitchLogin,
    title: session.title,
    categoryName: session.categoryName,
    startedAt: session.startedAt?.toISOString() || null,
    endedAt: session.endedAt?.toISOString() || null,
    peakConcurrent: session.peakConcurrent,
    averageConcurrent: Number(session.averageConcurrent || 0),
    lastConcurrent: session.lastConcurrent,
    peakTwitchConcurrent: session.peakTwitchConcurrent,
    averageTwitchConcurrent: session.averageTwitchConcurrent == null
      ? null
      : Number(session.averageTwitchConcurrent),
    audienceMinutes: session.audienceMinutes,
    sampleCount: session.sampleCount,
    lastSampleAt: session.lastSampleAt?.toISOString() || null,
    ...(includeSamples ? {
      samples: (session.samples || []).map((sample) => ({
        id: sample.id,
        capturedAt: sample.capturedAt.toISOString(),
        concurrentCount: sample.concurrentCount,
        twitchConcurrentCount: sample.twitchConcurrentCount,
      })),
    } : {}),
  };
}

export async function recordStreamAudienceSample({ stream, concurrentCount, capturedAt = new Date() }) {
  if (!usePostgres() || !stream?.id) return null;

  const prisma = getPrismaClient();
  const bucket = minuteBucket(capturedAt);
  const pageCount = Math.max(0, Math.trunc(Number(concurrentCount) || 0));
  const twitchCount = Number.isFinite(Number(stream.viewer_count))
    ? Math.max(0, Math.trunc(Number(stream.viewer_count)))
    : null;
  const startedAt = new Date(stream.started_at || bucket);

  return prisma.$transaction(async (tx) => {
    await tx.streamAudienceSession.updateMany({
      where: { twitchStreamId: { not: String(stream.id) }, endedAt: null },
      data: { endedAt: bucket, lastConcurrent: 0 },
    });

    const session = await tx.streamAudienceSession.upsert({
      where: { twitchStreamId: String(stream.id) },
      create: {
        twitchStreamId: String(stream.id),
        twitchLogin: String(stream.user_login || process.env.TWITCH_BROADCASTER_LOGIN || "").toLowerCase(),
        title: String(stream.title || "Directo de Twitch"),
        categoryName: stream.game_name ? String(stream.game_name) : null,
        startedAt: Number.isNaN(startedAt.getTime()) ? bucket : startedAt,
      },
      update: {
        twitchLogin: String(stream.user_login || process.env.TWITCH_BROADCASTER_LOGIN || "").toLowerCase(),
        title: String(stream.title || "Directo de Twitch"),
        categoryName: stream.game_name ? String(stream.game_name) : null,
        endedAt: null,
      },
    });

    await tx.streamAudienceSample.upsert({
      where: { sessionId_capturedAt: { sessionId: session.id, capturedAt: bucket } },
      create: {
        sessionId: session.id,
        capturedAt: bucket,
        concurrentCount: pageCount,
        twitchConcurrentCount: twitchCount,
      },
      update: {
        concurrentCount: pageCount,
        twitchConcurrentCount: twitchCount,
      },
    });

    const [pageStats, twitchStats] = await Promise.all([
      tx.streamAudienceSample.aggregate({
        where: { sessionId: session.id },
        _avg: { concurrentCount: true },
        _max: { concurrentCount: true },
        _sum: { concurrentCount: true },
        _count: { concurrentCount: true },
      }),
      tx.streamAudienceSample.aggregate({
        where: { sessionId: session.id, twitchConcurrentCount: { not: null } },
        _avg: { twitchConcurrentCount: true },
        _max: { twitchConcurrentCount: true },
      }),
    ]);

    return tx.streamAudienceSession.update({
      where: { id: session.id },
      data: {
        peakConcurrent: pageStats._max.concurrentCount || 0,
        averageConcurrent: pageStats._avg.concurrentCount || 0,
        lastConcurrent: pageCount,
        peakTwitchConcurrent: twitchStats._max.twitchConcurrentCount,
        averageTwitchConcurrent: twitchStats._avg.twitchConcurrentCount,
        audienceMinutes: pageStats._sum.concurrentCount || 0,
        sampleCount: pageStats._count.concurrentCount || 0,
        lastSampleAt: bucket,
      },
    });
  });
}

export async function closeActiveStreamAudienceSessions(endedAt = new Date()) {
  if (!usePostgres()) return 0;
  const result = await getPrismaClient().streamAudienceSession.updateMany({
    where: { endedAt: null },
    data: { endedAt: new Date(endedAt), lastConcurrent: 0 },
  });
  return result.count;
}

export async function getStreamAudienceDashboard({ sessionId = null, limit = DEFAULT_HISTORY_LIMIT } = {}) {
  if (!usePostgres()) {
    return { currentSession: null, selectedSession: null, history: [] };
  }

  const prisma = getPrismaClient();
  const take = Math.min(Math.max(Number(limit) || DEFAULT_HISTORY_LIMIT, 1), MAX_HISTORY_LIMIT);
  const [currentSession, history] = await Promise.all([
    prisma.streamAudienceSession.findFirst({
      where: { endedAt: null },
      include: { samples: { orderBy: { capturedAt: "asc" } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.streamAudienceSession.findMany({
      take,
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const selectedId = Number(sessionId) || currentSession?.id || history[0]?.id || null;
  const selectedSession = selectedId
    ? (currentSession?.id === selectedId
        ? currentSession
        : await prisma.streamAudienceSession.findUnique({
            where: { id: selectedId },
            include: { samples: { orderBy: { capturedAt: "asc" } } },
          }))
    : null;

  return {
    currentSession: serializeSession(currentSession, { includeSamples: true }),
    selectedSession: serializeSession(selectedSession, { includeSamples: true }),
    history: history.map((session) => serializeSession(session)),
  };
}
