CREATE TABLE "PlatformPermission" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformRolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE UNIQUE INDEX "PlatformPermission_code_key" ON "PlatformPermission"("code");
CREATE INDEX "PlatformPermission_group_idx" ON "PlatformPermission"("group");
CREATE INDEX "PlatformPermission_isActive_idx" ON "PlatformPermission"("isActive");
CREATE INDEX "PlatformPermission_sortOrder_idx" ON "PlatformPermission"("sortOrder");
CREATE INDEX "PlatformRolePermission_permissionId_idx" ON "PlatformRolePermission"("permissionId");

ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "PlatformPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
