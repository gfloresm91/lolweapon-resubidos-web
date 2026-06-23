-- AlterTable
ALTER TABLE "PlatformNotification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformNotification_dedupeKey_key" ON "PlatformNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformNotification_dedupeKey_idx" ON "PlatformNotification"("dedupeKey");
