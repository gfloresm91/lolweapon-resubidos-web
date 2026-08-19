-- AlterTable
ALTER TABLE "PlatformNotification" ADD COLUMN     "pushedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformMobilePushToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER,
    "clientType" TEXT NOT NULL,
    "deviceId" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "PlatformMobilePushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformMobilePushToken_token_key" ON "PlatformMobilePushToken"("token");

-- CreateIndex
CREATE INDEX "PlatformMobilePushToken_userId_idx" ON "PlatformMobilePushToken"("userId");

-- CreateIndex
CREATE INDEX "PlatformMobilePushToken_disabledAt_idx" ON "PlatformMobilePushToken"("disabledAt");

-- AddForeignKey
ALTER TABLE "PlatformMobilePushToken" ADD CONSTRAINT "PlatformMobilePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
