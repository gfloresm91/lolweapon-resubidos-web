CREATE TABLE "PlatformUserAnime" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "animeId" INTEGER NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "listStatus" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "favoritedAt" TIMESTAMP(3),
    "statusUpdatedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUserAnime_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformUserAnime_userId_animeId_key" ON "PlatformUserAnime"("userId", "animeId");
CREATE INDEX "PlatformUserAnime_userId_idx" ON "PlatformUserAnime"("userId");
CREATE INDEX "PlatformUserAnime_animeId_idx" ON "PlatformUserAnime"("animeId");
CREATE INDEX "PlatformUserAnime_isFavorite_idx" ON "PlatformUserAnime"("isFavorite");
CREATE INDEX "PlatformUserAnime_listStatus_idx" ON "PlatformUserAnime"("listStatus");
CREATE INDEX "PlatformUserAnime_isHidden_idx" ON "PlatformUserAnime"("isHidden");

ALTER TABLE "PlatformUserAnime" ADD CONSTRAINT "PlatformUserAnime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformUserAnime" ADD CONSTRAINT "PlatformUserAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
