-- CreateTable
CREATE TABLE "PlatformUserLivePlayback" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "liveId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "partIndex" INTEGER NOT NULL,
    "positionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUserLivePlayback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformUserLivePlayback_userId_idx" ON "PlatformUserLivePlayback"("userId");

-- CreateIndex
CREATE INDEX "PlatformUserLivePlayback_liveId_idx" ON "PlatformUserLivePlayback"("liveId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUserLivePlayback_userId_liveId_source_partIndex_key" ON "PlatformUserLivePlayback"("userId", "liveId", "source", "partIndex");

-- AddForeignKey
ALTER TABLE "PlatformUserLivePlayback" ADD CONSTRAINT "PlatformUserLivePlayback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserLivePlayback" ADD CONSTRAINT "PlatformUserLivePlayback_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "Live"("id") ON DELETE CASCADE ON UPDATE CASCADE;
