INSERT INTO "PlatformPermission" ("code", "label", "group", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('admin.tracker.view', 'Ver mantenedor Rastreador', 'Administración: Rastreador', 80, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group" = EXCLUDED."group",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = NOW();

UPDATE "PlatformPermission"
SET "sortOrder" = 90, "updatedAt" = NOW()
WHERE "code" = 'admin.anime.tracking.view';

UPDATE "PlatformPermission"
SET "sortOrder" = 100, "updatedAt" = NOW()
WHERE "code" = 'admin.anime.completed.view';

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "PlatformRole" r
JOIN "PlatformPermission" p
  ON p."code" = 'admin.tracker.view'
WHERE r."code" IN ('dios', 'admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
