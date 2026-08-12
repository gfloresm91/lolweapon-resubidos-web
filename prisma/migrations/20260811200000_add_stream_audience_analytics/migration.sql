CREATE TABLE "StreamAudienceSession" (
  "id" SERIAL NOT NULL,
  "liveId" INTEGER,
  "twitchStreamId" TEXT NOT NULL,
  "twitchLogin" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "categoryName" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "peakConcurrent" INTEGER NOT NULL DEFAULT 0,
  "averageConcurrent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastConcurrent" INTEGER NOT NULL DEFAULT 0,
  "peakTwitchConcurrent" INTEGER,
  "averageTwitchConcurrent" DOUBLE PRECISION,
  "audienceMinutes" INTEGER NOT NULL DEFAULT 0,
  "sampleCount" INTEGER NOT NULL DEFAULT 0,
  "lastSampleAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StreamAudienceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StreamAudienceSample" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "concurrentCount" INTEGER NOT NULL,
  "twitchConcurrentCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreamAudienceSample_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamAudienceSession_twitchStreamId_key" ON "StreamAudienceSession"("twitchStreamId");
CREATE INDEX "StreamAudienceSession_liveId_idx" ON "StreamAudienceSession"("liveId");
CREATE INDEX "StreamAudienceSession_startedAt_idx" ON "StreamAudienceSession"("startedAt");
CREATE INDEX "StreamAudienceSession_endedAt_idx" ON "StreamAudienceSession"("endedAt");
CREATE UNIQUE INDEX "StreamAudienceSample_sessionId_capturedAt_key" ON "StreamAudienceSample"("sessionId", "capturedAt");
CREATE INDEX "StreamAudienceSample_capturedAt_idx" ON "StreamAudienceSample"("capturedAt");

ALTER TABLE "StreamAudienceSession"
  ADD CONSTRAINT "StreamAudienceSession_liveId_fkey"
  FOREIGN KEY ("liveId") REFERENCES "Live"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StreamAudienceSample"
  ADD CONSTRAINT "StreamAudienceSample_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "StreamAudienceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlatformPermission" ("code", "label", "group", "description", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES (
  'admin.audience.view',
  'Ver audiencia web',
  'Administración: Audiencia web',
  'Consulta presencia concurrente e historial agregado por directo.',
  469,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group" = EXCLUDED."group",
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId", "assignedAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "PlatformRole" role
JOIN "PlatformPermission" permission ON permission."code" = 'admin.audience.view'
WHERE role."code" IN ('dios', 'admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
