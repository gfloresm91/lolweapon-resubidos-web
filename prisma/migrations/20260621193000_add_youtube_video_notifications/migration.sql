-- CreateTable
CREATE TABLE "YoutubeVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "thumbnail" TEXT,
    "url" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YoutubeVideo_publishedAt_idx" ON "YoutubeVideo"("publishedAt");

-- CreateIndex
CREATE INDEX "YoutubeVideo_createdAt_idx" ON "YoutubeVideo"("createdAt");

-- CreateIndex
CREATE INDEX "YoutubeVideo_notifiedAt_idx" ON "YoutubeVideo"("notifiedAt");
