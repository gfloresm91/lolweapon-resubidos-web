-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" SERIAL NOT NULL,
    "twitchUserId" TEXT,
    "login" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSession" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_twitchUserId_key" ON "PlatformUser"("twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_login_key" ON "PlatformUser"("login");

-- CreateIndex
CREATE INDEX "PlatformUser_role_idx" ON "PlatformUser"("role");

-- CreateIndex
CREATE INDEX "PlatformUser_isActive_idx" ON "PlatformUser"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSession_token_key" ON "PlatformSession"("token");

-- CreateIndex
CREATE INDEX "PlatformSession_userId_idx" ON "PlatformSession"("userId");

-- CreateIndex
CREATE INDEX "PlatformSession_expiresAt_idx" ON "PlatformSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
