ALTER TABLE "PlatformNotification"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3),
ADD COLUMN "scheduledAt" TIMESTAMP(3),
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "PlatformNotification"
SET "publishedAt" = "createdAt",
    "updatedAt" = "createdAt";

ALTER TABLE "PlatformNotification"
ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE INDEX "PlatformNotification_source_idx" ON "PlatformNotification"("source");
CREATE INDEX "PlatformNotification_isActive_idx" ON "PlatformNotification"("isActive");
CREATE INDEX "PlatformNotification_scheduledAt_idx" ON "PlatformNotification"("scheduledAt");
CREATE INDEX "PlatformNotification_publishedAt_idx" ON "PlatformNotification"("publishedAt");
CREATE INDEX "PlatformNotification_deletedAt_idx" ON "PlatformNotification"("deletedAt");
