CREATE TABLE "PlatformUserLive" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "liveId" INTEGER NOT NULL,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "isWatched" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3),
    "watchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUserLive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformUserLive_userId_liveId_key" ON "PlatformUserLive"("userId", "liveId");
CREATE INDEX "PlatformUserLive_userId_idx" ON "PlatformUserLive"("userId");
CREATE INDEX "PlatformUserLive_liveId_idx" ON "PlatformUserLive"("liveId");
CREATE INDEX "PlatformUserLive_isSaved_idx" ON "PlatformUserLive"("isSaved");
CREATE INDEX "PlatformUserLive_isWatched_idx" ON "PlatformUserLive"("isWatched");

ALTER TABLE "PlatformUserLive" ADD CONSTRAINT "PlatformUserLive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformUserLive" ADD CONSTRAINT "PlatformUserLive_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "Live"("id") ON DELETE CASCADE ON UPDATE CASCADE;
