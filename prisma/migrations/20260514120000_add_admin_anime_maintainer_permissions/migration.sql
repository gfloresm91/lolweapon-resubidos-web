INSERT INTO "PlatformPermission" ("code", "label", "group", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('admin.anime.tracking.view', 'Ver mantenedor Viendo', 'Administración: Viendo', 80, true, NOW(), NOW()),
  ('admin.anime.completed.view', 'Ver mantenedor Terminados', 'Administración: Terminados', 90, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group" = EXCLUDED."group",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = NOW();

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "PlatformRole" r
JOIN "PlatformPermission" p
  ON p."code" IN ('admin.anime.tracking.view', 'admin.anime.completed.view')
WHERE r."code" IN ('dios', 'admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
