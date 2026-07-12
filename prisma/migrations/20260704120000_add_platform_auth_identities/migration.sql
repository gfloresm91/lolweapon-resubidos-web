CREATE TABLE "PlatformAuthIdentity" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "providerEmail" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "providerLogin" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "metadata" JSONB,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformAuthIdentity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlatformUser" ADD COLUMN "roleSource" TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE "PlatformIdentityLinkAttempt" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "providerEmail" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "providerLogin" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformIdentityLinkAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAuthIdentity_provider_providerSubject_key" ON "PlatformAuthIdentity"("provider", "providerSubject");
CREATE UNIQUE INDEX "PlatformAuthIdentity_userId_provider_key" ON "PlatformAuthIdentity"("userId", "provider");
CREATE INDEX "PlatformAuthIdentity_userId_idx" ON "PlatformAuthIdentity"("userId");
CREATE INDEX "PlatformAuthIdentity_providerEmail_idx" ON "PlatformAuthIdentity"("providerEmail");
CREATE INDEX "PlatformIdentityLinkAttempt_userId_idx" ON "PlatformIdentityLinkAttempt"("userId");
CREATE INDEX "PlatformIdentityLinkAttempt_expiresAt_idx" ON "PlatformIdentityLinkAttempt"("expiresAt");
CREATE INDEX "PlatformIdentityLinkAttempt_provider_providerSubject_idx" ON "PlatformIdentityLinkAttempt"("provider", "providerSubject");

ALTER TABLE "PlatformAuthIdentity" ADD CONSTRAINT "PlatformAuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformIdentityLinkAttempt" ADD CONSTRAINT "PlatformIdentityLinkAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlatformAuthIdentity" (
    "userId",
    "provider",
    "providerSubject",
    "providerEmail",
    "emailVerified",
    "providerLogin",
    "displayName",
    "avatarUrl",
    "linkedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    'twitch',
    "twitchUserId",
    "email",
    false,
    "login",
    "alias",
    "avatarUrl",
    "createdAt",
    "createdAt",
    CURRENT_TIMESTAMP
FROM "PlatformUser"
WHERE "twitchUserId" IS NOT NULL
ON CONFLICT ("provider", "providerSubject") DO NOTHING;

UPDATE "PlatformUser" AS users
SET "roleSource" = 'twitch'
FROM "PlatformRole" AS roles
WHERE users."roleId" = roles."id"
  AND users."twitchUserId" IS NOT NULL
  AND (
    roles."code" = 'publico'
    OR (roles."code" = 'moderador' AND users."isTwitchModerator" = true)
    OR (roles."code" = 'tw-vip' AND users."isTwitchVip" = true)
    OR (roles."code" = 'tw-tier-1' AND users."twitchSubscriberTier" = '1000')
    OR (roles."code" = 'tw-tier-2' AND users."twitchSubscriberTier" = '2000')
    OR (roles."code" = 'tw-tier-3' AND users."twitchSubscriberTier" = '3000')
  );
