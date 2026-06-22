-- CreateTable
CREATE TABLE "PlatformNotification" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "icon" TEXT,
    "metadata" JSONB,
    "audience" TEXT NOT NULL DEFAULT 'authenticated',
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "PlatformNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformUserNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformUserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformNotification_type_idx" ON "PlatformNotification"("type");

-- CreateIndex
CREATE INDEX "PlatformNotification_severity_idx" ON "PlatformNotification"("severity");

-- CreateIndex
CREATE INDEX "PlatformNotification_audience_idx" ON "PlatformNotification"("audience");

-- CreateIndex
CREATE INDEX "PlatformNotification_createdByUserId_idx" ON "PlatformNotification"("createdByUserId");

-- CreateIndex
CREATE INDEX "PlatformNotification_createdAt_idx" ON "PlatformNotification"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformNotification_expiresAt_idx" ON "PlatformNotification"("expiresAt");

-- CreateIndex
CREATE INDEX "PlatformUserNotification_userId_idx" ON "PlatformUserNotification"("userId");

-- CreateIndex
CREATE INDEX "PlatformUserNotification_notificationId_idx" ON "PlatformUserNotification"("notificationId");

-- CreateIndex
CREATE INDEX "PlatformUserNotification_readAt_idx" ON "PlatformUserNotification"("readAt");

-- CreateIndex
CREATE INDEX "PlatformUserNotification_dismissedAt_idx" ON "PlatformUserNotification"("dismissedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUserNotification_userId_notificationId_key" ON "PlatformUserNotification"("userId", "notificationId");

-- AddForeignKey
ALTER TABLE "PlatformNotification" ADD CONSTRAINT "PlatformNotification_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserNotification" ADD CONSTRAINT "PlatformUserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserNotification" ADD CONSTRAINT "PlatformUserNotification_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "PlatformNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
