ALTER TABLE "PlatformUser" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "PlatformUser_deletedAt_idx" ON "PlatformUser"("deletedAt");
