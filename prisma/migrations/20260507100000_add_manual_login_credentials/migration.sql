-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN "passwordSalt" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3);
