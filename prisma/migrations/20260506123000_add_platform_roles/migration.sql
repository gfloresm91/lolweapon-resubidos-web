-- CreateTable
CREATE TABLE "PlatformRole" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRole_code_key" ON "PlatformRole"("code");

-- SeedRoles
INSERT INTO "PlatformRole" ("code", "label", "sortOrder", "isActive", "canAdmin", "updatedAt")
VALUES
  ('dios', 'Dios', 10, true, true, CURRENT_TIMESTAMP),
  ('admin', 'Admin', 20, true, true, CURRENT_TIMESTAMP),
  ('moderador', 'Moderador', 30, true, true, CURRENT_TIMESTAMP),
  ('tw-tier-1', 'TW_Tier 1', 40, true, false, CURRENT_TIMESTAMP),
  ('tw-tier-2', 'TW_Tier 2', 50, true, false, CURRENT_TIMESTAMP),
  ('tw-tier-3', 'TW_Tier 3', 60, true, false, CURRENT_TIMESTAMP),
  ('yt-miembro', 'YT_Miembro', 70, true, false, CURRENT_TIMESTAMP),
  ('publico', 'Publico', 80, true, false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN "roleId" INTEGER;

-- BackfillRoles
UPDATE "PlatformUser"
SET "roleId" = CASE
  WHEN "role" = 'moderator' THEN (SELECT "id" FROM "PlatformRole" WHERE "code" = 'moderador')
  WHEN "role" = 'viewer' THEN (SELECT "id" FROM "PlatformRole" WHERE "code" = 'publico')
  ELSE (SELECT "id" FROM "PlatformRole" WHERE "code" = 'admin')
END
WHERE "roleId" IS NULL;

ALTER TABLE "PlatformUser" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "PlatformUser" DROP COLUMN "role";

-- CreateIndex
CREATE INDEX "PlatformRole_isActive_idx" ON "PlatformRole"("isActive");

-- CreateIndex
CREATE INDEX "PlatformRole_canAdmin_idx" ON "PlatformRole"("canAdmin");

-- CreateIndex
CREATE INDEX "PlatformRole_sortOrder_idx" ON "PlatformRole"("sortOrder");

-- CreateIndex
CREATE INDEX "PlatformUser_roleId_idx" ON "PlatformUser"("roleId");

-- AddForeignKey
ALTER TABLE "PlatformUser" ADD CONSTRAINT "PlatformUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
