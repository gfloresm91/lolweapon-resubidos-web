CREATE TABLE "PlatformUserSpaceDrumProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "lastChapterId" TEXT,
    "readChapterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUserSpaceDrumProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformUserSpaceDrumProgress_userId_language_key" ON "PlatformUserSpaceDrumProgress"("userId", "language");
CREATE INDEX "PlatformUserSpaceDrumProgress_userId_idx" ON "PlatformUserSpaceDrumProgress"("userId");
CREATE INDEX "PlatformUserSpaceDrumProgress_language_idx" ON "PlatformUserSpaceDrumProgress"("language");

ALTER TABLE "PlatformUserSpaceDrumProgress" ADD CONSTRAINT "PlatformUserSpaceDrumProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
