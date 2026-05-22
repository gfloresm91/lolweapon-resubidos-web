-- CreateTable
CREATE TABLE "AnimeRating" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "animeId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimeRating_userId_idx" ON "AnimeRating"("userId");

-- CreateIndex
CREATE INDEX "AnimeRating_animeId_idx" ON "AnimeRating"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeRating_userId_animeId_key" ON "AnimeRating"("userId", "animeId");

-- AddForeignKey
ALTER TABLE "AnimeRating" ADD CONSTRAINT "AnimeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeRating" ADD CONSTRAINT "AnimeRating_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
