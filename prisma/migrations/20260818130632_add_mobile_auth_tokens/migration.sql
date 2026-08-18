-- CreateTable
CREATE TABLE "PlatformMobileRefreshToken" (
    "id" SERIAL NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "clientType" TEXT NOT NULL,
    "deviceId" TEXT,
    "parentId" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdIp" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "PlatformMobileRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformMobileAccessToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "refreshFamilyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformMobileAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformMobileOAuthExchange" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "clientType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformMobileOAuthExchange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformMobileRefreshToken_tokenHash_key" ON "PlatformMobileRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PlatformMobileRefreshToken_userId_idx" ON "PlatformMobileRefreshToken"("userId");

-- CreateIndex
CREATE INDEX "PlatformMobileRefreshToken_familyId_idx" ON "PlatformMobileRefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "PlatformMobileRefreshToken_expiresAt_idx" ON "PlatformMobileRefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformMobileAccessToken_tokenHash_key" ON "PlatformMobileAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PlatformMobileAccessToken_userId_idx" ON "PlatformMobileAccessToken"("userId");

-- CreateIndex
CREATE INDEX "PlatformMobileAccessToken_refreshFamilyId_idx" ON "PlatformMobileAccessToken"("refreshFamilyId");

-- CreateIndex
CREATE INDEX "PlatformMobileAccessToken_expiresAt_idx" ON "PlatformMobileAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PlatformMobileOAuthExchange_expiresAt_idx" ON "PlatformMobileOAuthExchange"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlatformMobileRefreshToken" ADD CONSTRAINT "PlatformMobileRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMobileAccessToken" ADD CONSTRAINT "PlatformMobileAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMobileOAuthExchange" ADD CONSTRAINT "PlatformMobileOAuthExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
