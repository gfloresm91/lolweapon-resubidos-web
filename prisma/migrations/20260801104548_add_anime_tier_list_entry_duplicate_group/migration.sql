-- AlterTable
ALTER TABLE "AnimeTierListEntry" ADD COLUMN "duplicateGroupId" INTEGER;

-- CreateIndex
CREATE INDEX "AnimeTierListEntry_duplicateGroupId_idx" ON "AnimeTierListEntry"("duplicateGroupId");
