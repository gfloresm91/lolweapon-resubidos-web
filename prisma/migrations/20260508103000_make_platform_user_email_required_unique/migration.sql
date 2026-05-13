UPDATE "PlatformUser"
SET "email" = lower(btrim("email"))
WHERE "email" IS NOT NULL;

UPDATE "PlatformUser"
SET "email" = lower("login") || '@local.invalid'
WHERE "email" IS NULL OR btrim("email") = '';

ALTER TABLE "PlatformUser" ALTER COLUMN "email" SET NOT NULL;

CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");
