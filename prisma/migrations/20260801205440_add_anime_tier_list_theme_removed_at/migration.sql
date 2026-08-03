-- AlterTable
ALTER TABLE "AnimeTierListTheme" ADD COLUMN "removedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AnimeTierListTheme_removedAt_idx" ON "AnimeTierListTheme"("removedAt");
