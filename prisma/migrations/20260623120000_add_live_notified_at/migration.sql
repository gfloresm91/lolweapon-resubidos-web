-- AlterTable
ALTER TABLE "Live" ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Live_notifiedAt_idx" ON "Live"("notifiedAt");
