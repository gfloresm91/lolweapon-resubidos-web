INSERT INTO "PlatformPermission" ("code", "label", "group", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES ('news.view', 'Ver novedades', 'Novedades', 2, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group" = EXCLUDED."group",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId", "assignedAt")
SELECT r."id", p."id", NOW()
FROM "PlatformRole" r
JOIN "PlatformPermission" p ON p."code" = 'news.view'
WHERE r."code" IN (
  'dios',
  'admin',
  'moderador',
  'tw-tier-1',
  'tw-tier-2',
  'tw-tier-3',
  'tw-vip',
  'yt-miembro',
  'publico',
  'invitado'
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
