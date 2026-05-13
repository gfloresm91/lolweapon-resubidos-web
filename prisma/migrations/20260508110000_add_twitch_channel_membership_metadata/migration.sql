ALTER TABLE "PlatformUser"
ADD COLUMN "twitchSubscriberTier" TEXT,
ADD COLUMN "isTwitchModerator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isTwitchVip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twitchRoleSyncedAt" TIMESTAMP(3);
