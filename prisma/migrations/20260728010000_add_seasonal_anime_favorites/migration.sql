-- Favoritos de anime de temporada por usuario, referenciados por aniListId (estable entre temporadas).
CREATE TABLE "PlatformUserSeasonalAnimeFavorite" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "aniListId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformUserSeasonalAnimeFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformUserSeasonalAnimeFavorite_userId_aniListId_key" ON "PlatformUserSeasonalAnimeFavorite"("userId", "aniListId");

CREATE INDEX "PlatformUserSeasonalAnimeFavorite_userId_idx" ON "PlatformUserSeasonalAnimeFavorite"("userId");

ALTER TABLE "PlatformUserSeasonalAnimeFavorite" ADD CONSTRAINT "PlatformUserSeasonalAnimeFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
